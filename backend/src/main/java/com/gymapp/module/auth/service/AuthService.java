package com.gymapp.module.auth.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.auth.dto.*;
import com.gymapp.module.auth.entity.*;
import com.gymapp.module.auth.repository.*;
import com.gymapp.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final GymRepository         gymRepository;
    private final UserRepository        userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final LoginAttemptRepository loginAttemptRepository;
    private final PasswordEncoder        passwordEncoder;
    private final JwtUtil                jwtUtil;
    private final com.gymapp.module.trainer.service.TrainerTypeService trainerTypeService;
    private final com.gymapp.module.trainer.repository.TrainerTypeRepository trainerTypeRepository;

    @Value("${app.trial.duration-days}")
    private int trialDurationDays;

    @Value("${app.jwt.refresh-token-expiry-days}")
    private int refreshTokenExpiryDays;

    @Value("${app.login.max-attempts}")
    private int maxLoginAttempts;

    @Value("${app.login.lockout-minutes}")
    private int lockoutMinutes;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Creates a new gym tenant and its owner account, starting a trial period.
     * Transactional: both gym and owner are rolled back if either fails.
     */
    @Transactional
    public GymResponse registerGym(RegisterGymRequest request) {
        // ownerPhone doubles as the gym's contact number; check for duplicates on it.
        if (gymRepository.existsByPhone(request.getOwnerPhone())) {
            throw new AppException(ErrorCode.PHONE_ALREADY_EXISTS,
                    "An account with this mobile number already exists");
        }

        // Generate a unique short code for the gym (used as login identifier)
        String gymCode = generateUniqueGymCode(request.getGymName());

        LocalDateTime trialEndsAt = LocalDateTime.now().plusDays(trialDurationDays);

        Gym gym = Gym.builder()
                .name(request.getGymName())
                .ownerName(request.getOwnerName())
                .phone(request.getOwnerPhone())   // owner's number is the gym contact
                .address(request.getCity())        // city stored in the address field
                .gymCode(gymCode)
                .status("TRIAL")
                .subscriptionValidTill(trialEndsAt.toLocalDate())
                .build();

        gym = gymRepository.save(gym);
        log.info("Gym registered: id={}, code={}", gym.getId(), gymCode);

        User owner = User.builder()
                .gymId(gym.getId())
                .name(request.getOwnerName())
                .phone(request.getOwnerPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role("OWNER")
                .active(true)
                .status("ACTIVE")
                .build();

        userRepository.save(owner);
        log.info("Owner created: userId={}, gymId={}", owner.getId(), gym.getId());

        // Seed default trainer types on gym creation
        trainerTypeService.seedDefaultsForGym(gym.getId());

        return GymResponse.builder()
                .gymId(gym.getId())
                .gymName(gym.getName())
                .gymCode(gymCode)
                .ownerName(owner.getName())
                .ownerPhone(owner.getPhone())
                .trialEndsAt(gym.getSubscriptionValidTill().atStartOfDay())
                .build();
    }

    /**
     * Authenticates a user and issues access + refresh tokens.
     *
     * Flow:
     *  1. If gymCode is blank → SUPER_ADMIN login path (no gym context).
     *  2. Otherwise → resolve gym, validate its status, find user within gym.
     *  3. Check lockout (after gym is found, keyed on gymId:phone).
     *  4. Validate password; on failure increment lockout counter.
     *  5. On success clear lockout counter and issue tokens.
     */
    public TokenResponse login(LoginRequest request) {
        boolean isGymCodeProvided = request.getGymCode() != null
                && !request.getGymCode().isBlank();

        if (!isGymCodeProvided) {
            // 1. Check if user is SUPER_ADMIN
            Optional<User> superAdmin = userRepository.findByPhoneAndRole(request.getPhone(), "SUPER_ADMIN");
            if (superAdmin.isPresent()) {
                return loginSuperAdmin(request);
            }

            // 2. Auto-detect Gym for user (e.g. Owner) via globally unique phone
            User user = userRepository.findByPhone(request.getPhone())
                    .orElseThrow(() -> new AppException(ErrorCode.INVALID_CREDENTIALS));

            if (user.getGymId() == null) {
                throw new AppException(ErrorCode.INVALID_CREDENTIALS);
            }

            Gym gym = gymRepository.findById(user.getGymId())
                    .orElseThrow(() -> new AppException(ErrorCode.INVALID_CREDENTIALS));

            validateGymStatus(gym);

            String lockoutKey = buildLockoutKey(gym.getId(), request.getPhone());
            enforceLoginLockout(lockoutKey);

            return authenticateAndIssueTokens(user, request.getPassword(), lockoutKey);
        }

        // ── Gym-user login with explicitly provided gymCode ───────────────────

        Gym gym = gymRepository.findByGymCode(request.getGymCode().toUpperCase())
                .orElseThrow(() -> new AppException(ErrorCode.INVALID_CREDENTIALS));

        validateGymStatus(gym);

        // Lockout key is scoped to this gym so that a lockout in Gym A
        // doesn't affect the same phone number in Gym B.
        String lockoutKey = buildLockoutKey(gym.getId(), request.getPhone());
        enforceLoginLockout(lockoutKey);

        User user = userRepository.findByPhone(request.getPhone())
                .filter(u -> u.getGymId().equals(gym.getId()))
                .orElseThrow(() -> {
                    recordFailedAttempt(lockoutKey);
                    return new AppException(ErrorCode.INVALID_CREDENTIALS);
                });

        return authenticateAndIssueTokens(user, request.getPassword(), lockoutKey);
    }

    /**
     * Rotates the refresh token (single-use): deletes the presented token
     * and issues a new access + refresh pair.
     */
    @Transactional
    public TokenResponse refreshToken(RefreshTokenRequest request) {
        RefreshToken stored = refreshTokenRepository.findByToken(request.getRefreshToken())
                .orElseThrow(() -> new AppException(ErrorCode.REFRESH_TOKEN_NOT_FOUND));

        if (stored.isExpired()) {
            refreshTokenRepository.delete(stored);   // clean up expired token
            throw new AppException(ErrorCode.REFRESH_TOKEN_NOT_FOUND,
                    "Refresh token has expired. Please log in again.");
        }

        User user;
        if (stored.getGymId() != null) {
            user = userRepository.findByIdAndGymId(stored.getUserId(), stored.getGymId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        } else {
            user = userRepository.findById(stored.getUserId())
                    .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));
        }

        // Rotate: delete old token, issue new pair
        refreshTokenRepository.delete(stored);
        return buildTokenResponse(user);
    }

    /**
     * Creates a STAFF account scoped to the caller's gym.
     * gymId is taken from TenantContext (set by JwtFilter) — never from request body.
     */
    @Transactional
    public void createStaff(CreateStaffRequest request) {
        if (com.gymapp.security.SecurityUtils.getCurrentRole() != null && !com.gymapp.security.SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId(); // always set by JwtFilter for authenticated requests

        if (userRepository.existsByPhone(request.getPhone())) {
            throw new AppException(ErrorCode.USER_ALREADY_EXISTS);
        }

        User staff = User.builder()
                .gymId(gymId)
                .name(request.getName())
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role("STAFF")
                .active(true)
                .status("ACTIVE")
                .build();

        userRepository.save(staff);
        log.info("Staff created: phone={}, gymId={}", com.gymapp.common.PhoneMasker.mask(request.getPhone()), gymId);
    }

    public List<StaffResponse> getStaffList() {
        if (com.gymapp.security.SecurityUtils.getCurrentRole() != null && !com.gymapp.security.SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        return userRepository.findByGymIdAndRole(gymId, "STAFF").stream()
                .map(u -> StaffResponse.builder()
                        .id(u.getId())
                        .gymId(u.getGymId())
                        .name(u.getName())
                        .phone(u.getPhone())
                        .role(u.getRole())
                        .active(u.isActive())
                        .status(u.getStatus())
                        .createdAt(u.getCreatedAt())
                        .build())
                .toList();
    }

    /**
     * Public self-registration for TRAINER accounts.
     * Starts with status = PENDING_APPROVAL and active = false.
     */
    @Transactional
    public void registerTrainer(RegisterTrainerRequest request) {
        Gym gym = gymRepository.findByGymCode(request.getGymCode().toUpperCase())
                .orElseThrow(() -> new AppException(ErrorCode.GYM_NOT_FOUND, "Invalid gym code"));

        validateGymStatus(gym);

        if (userRepository.existsByPhone(request.getPhone())) {
            throw new AppException(ErrorCode.PHONE_ALREADY_EXISTS,
                    "An account with this mobile number already exists");
        }

        User trainer = User.builder()
                .gymId(gym.getId())
                .name(request.getName())
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role("TRAINER")
                .active(false)
                .status("PENDING_APPROVAL")
                .trainerTypeIds(new java.util.ArrayList<>())
                .build();

        userRepository.save(trainer);
        log.info("Trainer registered (pending approval): phone={}, gymId={}",
                com.gymapp.common.PhoneMasker.mask(request.getPhone()), gym.getId());
    }

    @Transactional
    public void changePassword(String userId, ChangePasswordRequest request) {
        String gymId = TenantContext.getGymId();
        User user = (gymId != null)
                ? userRepository.findByIdAndGymId(userId, gymId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND))
                : userRepository.findById(userId).orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND));

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new AppException(ErrorCode.INVALID_CREDENTIALS, "Incorrect old password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private TokenResponse loginSuperAdmin(LoginRequest request) {
        String lockoutKey = "SUPER:" + request.getPhone();
        enforceLoginLockout(lockoutKey);

        User user = userRepository.findByPhoneAndRole(request.getPhone(), "SUPER_ADMIN")
                .orElseThrow(() -> {
                    recordFailedAttempt(lockoutKey);
                    return new AppException(ErrorCode.INVALID_CREDENTIALS);
                });

        return authenticateAndIssueTokens(user, request.getPassword(), lockoutKey);
    }

    private TokenResponse authenticateAndIssueTokens(User user, String rawPassword, String lockoutKey) {
        if ("PENDING_APPROVAL".equalsIgnoreCase(user.getStatus())) {
            throw new AppException(ErrorCode.TRAINER_PENDING_APPROVAL);
        }

        if ("REJECTED".equalsIgnoreCase(user.getStatus())) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Your trainer account registration was rejected");
        }

        if (!user.isActive()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "This account is inactive");
        }

        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            recordFailedAttempt(lockoutKey);
            throw new AppException(ErrorCode.INVALID_CREDENTIALS);
        }

        // Success — clear any accumulated failed attempts
        loginAttemptRepository.deleteByKey(lockoutKey);

        return buildTokenResponse(user);
    }

    private TokenResponse buildTokenResponse(User user) {
        String accessToken = jwtUtil.generateAccessToken(
                user.getId(), user.getGymId(), user.getRole());

        RefreshToken refreshToken = RefreshToken.builder()
                .token(UUID.randomUUID().toString())
                .userId(user.getId())
                .gymId(user.getGymId())
                .expiresAt(LocalDateTime.now().plusDays(refreshTokenExpiryDays))
                .createdAt(LocalDateTime.now())
                .build();

        refreshTokenRepository.save(refreshToken);

        String gymCode = null;
        if (user.getGymId() != null) {
            gymCode = gymRepository.findById(user.getGymId())
                    .map(Gym::getGymCode)
                    .orElse(null);
        }

        return TokenResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken.getToken())
                .tokenType("Bearer")
                .expiresIn(jwtUtil.getAccessTokenExpiryMs() / 1000)
                .userId(user.getId())
                .gymId(user.getGymId())
                .gymCode(gymCode)
                .role(user.getRole())
                .build();
    }

    private void enforceLoginLockout(String lockoutKey) {
        loginAttemptRepository.findByKey(lockoutKey).ifPresent(attempt -> {
            if (attempt.isLocked()) {
                throw new AppException(ErrorCode.ACCOUNT_LOCKED,
                        "Account locked until " + attempt.getLockedUntil()
                        + ". Too many failed login attempts.");
            }
        });
    }

    private void recordFailedAttempt(String lockoutKey) {
        LoginAttempt attempt = loginAttemptRepository.findByKey(lockoutKey)
                .orElse(LoginAttempt.builder().key(lockoutKey).attemptCount(0).build());

        attempt.setAttemptCount(attempt.getAttemptCount() + 1);
        attempt.setLastAttemptAt(LocalDateTime.now());

        // Lock the account after maxLoginAttempts consecutive failures
        if (attempt.getAttemptCount() >= maxLoginAttempts) {
            attempt.setLockedUntil(LocalDateTime.now().plusMinutes(lockoutMinutes));
            String maskedKey = lockoutKey;
            if (lockoutKey != null && lockoutKey.contains(":")) {
                String[] parts = lockoutKey.split(":", 2);
                maskedKey = parts[0] + ":" + com.gymapp.common.PhoneMasker.mask(parts[1]);
            }
            log.warn("Account locked [key={}] after {} failed attempts", maskedKey, attempt.getAttemptCount());
        }

        loginAttemptRepository.save(attempt);
    }

    private void validateGymStatus(Gym gym) {
        if ("SUSPENDED".equals(gym.getStatus())) {
            throw new AppException(ErrorCode.GYM_SUSPENDED);
        }
        if ("TRIAL".equals(gym.getStatus())
                && LocalDateTime.now().isAfter(gym.getSubscriptionValidTill().atStartOfDay())) {
            throw new AppException(ErrorCode.GYM_TRIAL_EXPIRED);
        }
    }

    private String buildLockoutKey(String gymId, String phone) {
        return gymId + ":" + phone;
    }

    /**
     * Generates a unique gym code: up to 6 alphanumeric chars from the gym name
     * followed by a random 4-digit suffix. Retries up to 5 times on collision.
     */
    private String generateUniqueGymCode(String gymName) {
        String prefix = gymName.toUpperCase()
                .replaceAll("[^A-Z0-9]", "");
        prefix = prefix.length() > 6 ? prefix.substring(0, 6) : prefix;

        for (int i = 0; i < 5; i++) {
            String code = prefix + (1000 + (int)(Math.random() * 9000));
            if (!gymRepository.existsByGymCode(code)) {
                return code;
            }
        }
        // Fallback: fully random 10-char code
        return UUID.randomUUID().toString().replaceAll("[^A-Z0-9]", "").substring(0, 10).toUpperCase();
    }

    public MeResponse getMe(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND, "User not found"));

        String gymName = null;
        String gymCode = null;
        if (user.getGymId() != null) {
            Optional<Gym> gymOpt = gymRepository.findById(user.getGymId());
            if (gymOpt.isPresent()) {
                gymName = gymOpt.get().getName();
                gymCode = gymOpt.get().getGymCode();
            }
        }

        List<com.gymapp.module.trainer.dto.TrainerTypeResponse> trainerTypes = new java.util.ArrayList<>();
        if ("TRAINER".equals(user.getRole()) && user.getTrainerTypeIds() != null && !user.getTrainerTypeIds().isEmpty()) {
            trainerTypes = trainerTypeRepository.findByGymIdAndIdIn(user.getGymId(), user.getTrainerTypeIds()).stream()
                    .map(t -> com.gymapp.module.trainer.dto.TrainerTypeResponse.builder()
                            .id(t.getId())
                            .name(t.getName())
                            .active(t.isActive())
                            .build())
                    .toList();
        }

        return MeResponse.builder()
                .id(user.getId())
                .userId(user.getId())
                .name(user.getName())
                .phone(user.getPhone())
                .role(user.getRole())
                .gymId(user.getGymId())
                .gymName(gymName)
                .gymCode(gymCode)
                .active(user.isActive())
                .status(user.getStatus())
                .trainerTypes(trainerTypes)
                .build();
    }

    @Transactional
    public MeResponse updateMe(String userId, UpdateMeRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND, "User not found"));

        if (request.getName() != null && !request.getName().isBlank()) {
            user.setName(request.getName().trim());
        }
        if (request.getPhone() != null && !request.getPhone().isBlank() && !request.getPhone().equals(user.getPhone())) {
            if (userRepository.existsByPhone(request.getPhone())) {
                throw new AppException(ErrorCode.PHONE_ALREADY_EXISTS, "Phone number already in use");
            }
            user.setPhone(request.getPhone().trim());
        }
        user = userRepository.save(user);

        // If OWNER and gym exists, update gym ownerName and phone
        if ("OWNER".equals(user.getRole()) && user.getGymId() != null) {
            gymRepository.findById(user.getGymId()).ifPresent(gym -> {
                if (request.getName() != null && !request.getName().isBlank()) {
                    gym.setOwnerName(request.getName().trim());
                }
                if (request.getPhone() != null && !request.getPhone().isBlank()) {
                    gym.setPhone(request.getPhone().trim());
                }
                gymRepository.save(gym);
            });
        }

        return getMe(user.getId());
    }
}
