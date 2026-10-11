package com.gymapp.module.auth.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.audit.service.AuditLogService;
import com.gymapp.module.auth.dto.*;
import com.gymapp.module.auth.entity.*;
import com.gymapp.module.auth.repository.*;
import com.gymapp.module.plan.service.PlanService;
import com.gymapp.module.trainer.dto.TrainerTypeResponse;
import com.gymapp.module.trainer.repository.TrainerTypeRepository;
import com.gymapp.module.trainer.service.TrainerTypeService;
import com.gymapp.security.JwtUtil;
import com.gymapp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Pattern INDIAN_PHONE_PATTERN = Pattern.compile("^[6-9]\\d{9}$");
    private static final Pattern UDYAM_PATTERN = Pattern.compile("^UDYAM-[A-Z]{2}-\\d{2}-\\d{7}$");
    private static final Pattern GSTIN_PATTERN = Pattern.compile("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");
    private static final Pattern NIC_PATTERN = Pattern.compile("^\\d{4,5}$");

    private final GymRepository gymRepository;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtUtil jwtUtil;
    private final TrainerTypeService trainerTypeService;
    private final TrainerTypeRepository trainerTypeRepository;
    private final PlanService planService;
    private final AuditLogService auditLogService;
    private final GymCodeGenerator gymCodeGenerator;

    @Value("${app.trial.duration-days:14}")
    private int trialDurationDays;

    @Value("${app.jwt.refresh-token-expiry-days:30}")
    private int refreshTokenExpiryDays;

    private final Map<String, java.time.Instant> usedRegistrationTokens = new ConcurrentHashMap<>();

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Completes gym-owner registration using a verified REGISTER-scoped JWT.
     * Phone comes strictly from the token, never from the request body.
     * Creates the Gym (14-day TRIAL, default plans, default trainer types) and the
     * OWNER user (ACTIVE) in a single transaction, then issues access + refresh tokens.
     */
    @Transactional
    public VerifyOtpResponse completeRegistration(
            String phone,
            String registrationToken,
            CompleteRegistrationRequest request) {

        if (!StringUtils.hasText(phone)) {
            throw new AppException(ErrorCode.UNAUTHORIZED, "Valid registration token is required");
        }
        String normalizedPhone = normalizeAndValidatePhone(phone);

        // Validation for registration fields
        validateRegistrationFields(request);

        java.time.Instant now = java.time.Instant.now();
        usedRegistrationTokens.entrySet().removeIf(e -> now.isAfter(e.getValue()));

        String tokenKey = StringUtils.hasText(registrationToken)
                ? OtpService.sha256Hex(registrationToken)
                : null;

        // Enforce single-use registration token
        if (tokenKey != null && usedRegistrationTokens.containsKey(tokenKey)) {
            throw new AppException(ErrorCode.INVALID_TOKEN, "Registration token has already been used");
        }

        // Reject if phone already exists (e.g. race condition or added as trainer/staff while holding registrationToken) with 409 Conflict
        if (userRepository.existsByPhone(normalizedPhone) || gymRepository.existsByPhone(normalizedPhone)) {
            if (tokenKey != null) {
                usedRegistrationTokens.put(tokenKey, now.plusSeconds(1800));
            }
            throw new AppException(ErrorCode.PHONE_ALREADY_EXISTS,
                    "An account with this mobile number already exists");
        }

        if (tokenKey != null) {
            usedRegistrationTokens.put(tokenKey, now.plusSeconds(1800));
        }

        int effectiveTrialDays = trialDurationDays > 0 ? trialDurationDays : 14;

        GymAddress address = GymAddress.builder()
                .line1(request.getAddress().getLine1().trim())
                .line2(StringUtils.hasText(request.getAddress().getLine2()) ? request.getAddress().getLine2().trim() : null)
                .state(IndianStates.canonicalName(request.getAddress().getState()))
                .district(request.getAddress().getDistrict().trim())
                .pincode(request.getAddress().getPincode().trim())
                .build();

        String normalizedLegalId = StringUtils.hasText(request.getLegalIdNumber())
                ? request.getLegalIdNumber().trim().toUpperCase()
                : null;

        Gym gym = Gym.builder()
                .name(request.getGymName().trim())
                .gymType(request.getGymType())
                .ownerName(request.getOwnerName().trim())
                .phone(normalizedPhone)
                .address(address)
                .legalIdType(request.getLegalIdType())
                .legalIdNumber(normalizedLegalId)
                .legalIdVerified(false)
                .termsAcceptedAt(Instant.now())
                .termsVersion(request.getTermsVersion().trim())
                .status("TRIAL")
                .subscriptionValidTill(LocalDate.now().plusDays(effectiveTrialDays))
                .build();

        String rawRefreshToken = UUID.randomUUID().toString();
        String refreshHash = OtpService.sha256Hex(rawRefreshToken);

        User owner;
        try {
            gym = saveGymWithUniqueGymCode(gym);
            log.info("Gym registered via OTP: id={}", gym.getId());

            String normalizedEmail = (request.getEmail() != null && !request.getEmail().isBlank())
                    ? request.getEmail().trim()
                    : null;

            owner = User.builder()
                    .gymId(gym.getId())
                    .name(request.getOwnerName().trim())
                    .phone(normalizedPhone)
                    .email(normalizedEmail)
                    .role("OWNER")
                    .active(true)
                    .status("ACTIVE")
                    .tokenVersion(0)
                    .refreshTokenHash(refreshHash)
                    .build();

            owner = userRepository.save(owner);
            log.info("Owner created: userId={}, gymId={}", owner.getId(), gym.getId());
        } catch (org.springframework.dao.DuplicateKeyException ex) {
            throw new AppException(ErrorCode.PHONE_ALREADY_EXISTS,
                    "An account with this mobile number already exists");
        }

        // Seed default plans and default trainer types on gym creation
        if (planService != null) {
            planService.seedDefaultsForGym(gym.getId());
        }
        if (trainerTypeService != null) {
            trainerTypeService.seedDefaultsForGym(gym.getId());
        }

        int effectiveRefreshDays = refreshTokenExpiryDays > 0 ? refreshTokenExpiryDays : 30;
        String accessToken = jwtUtil.generateAccessToken(owner.getId(), gym.getId(), owner.getRole());

        RefreshToken refreshToken = RefreshToken.builder()
                .token(rawRefreshToken)
                .userId(owner.getId())
                .gymId(gym.getId())
                .expiresAt(LocalDateTime.now().plusDays(effectiveRefreshDays))
                .createdAt(LocalDateTime.now())
                .build();
        refreshTokenRepository.save(refreshToken);

        return VerifyOtpResponse.builder()
                .isNewUser(false)
                .accessToken(accessToken)
                .refreshToken(rawRefreshToken)
                .user(VerifyOtpResponse.UserSummary.builder()
                        .id(owner.getId())
                        .name(owner.getName())
                        .role(owner.getRole())
                        .gymId(gym.getId())
                        .gymName(gym.getName())
                        .build())
                .gym(VerifyOtpResponse.GymSummary.builder()
                        .id(gym.getId())
                        .name(gym.getName())
                        .gymCode(gym.getGymCode())
                        .gymType(gym.getGymType() != null ? gym.getGymType().name() : null)
                        .build())
                .build();
    }

    private void validateRegistrationFields(CompleteRegistrationRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();

        if (request.getAddress() != null && StringUtils.hasText(request.getAddress().getState())) {
            if (!IndianStates.isValidState(request.getAddress().getState())) {
                fieldErrors.put("address.state", "State must be a valid Indian state or UT");
            }
        }

        boolean hasLegalType = request.getLegalIdType() != null;
        boolean hasLegalNumber = StringUtils.hasText(request.getLegalIdNumber());

        if (hasLegalType != hasLegalNumber) {
            if (!hasLegalType) {
                fieldErrors.put("legalIdType", "legalIdType is required when legalIdNumber is provided");
            }
            if (!hasLegalNumber) {
                fieldErrors.put("legalIdNumber", "legalIdNumber is required when legalIdType is provided");
            }
        } else if (hasLegalType) {
            String idNum = request.getLegalIdNumber().trim().toUpperCase();
            switch (request.getLegalIdType()) {
                case UDYAM -> {
                    if (!UDYAM_PATTERN.matcher(idNum).matches()) {
                        fieldErrors.put("legalIdNumber", "UDYAM format is invalid (expected UDYAM-XX-00-0000000)");
                    }
                }
                case GSTIN -> {
                    if (!GSTIN_PATTERN.matcher(idNum).matches()) {
                        fieldErrors.put("legalIdNumber", "GSTIN format is invalid");
                    }
                }
                case NIC -> {
                    if (!NIC_PATTERN.matcher(idNum).matches()) {
                        fieldErrors.put("legalIdNumber", "NIC format is invalid (expected 4-5 digits)");
                    }
                }
            }
        }

        if (!fieldErrors.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Validation failed", fieldErrors);
        }
    }

    private Gym saveGymWithUniqueGymCode(Gym gym) {
        for (int i = 0; i < 5; i++) {
            String code = gymCodeGenerator.generate();
            if (!gymRepository.existsByGymCode(code)) {
                gym.setGymCode(code);
                try {
                    return gymRepository.save(gym);
                } catch (org.springframework.dao.DuplicateKeyException ex) {
                    log.warn("Collision generating gymCode (duplicate key), retrying... (attempt {})", i + 1);
                }
            } else {
                log.warn("Collision generating gymCode (already exists), retrying... (attempt {})", i + 1);
            }
        }
        throw new AppException(ErrorCode.INTERNAL_ERROR, "Failed to generate unique gym code. Please try again.");
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
            refreshTokenRepository.delete(stored);
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

        if (!user.isActive() || "INACTIVE".equalsIgnoreCase(user.getStatus())) {
            refreshTokenRepository.delete(stored);
            throw new AppException(ErrorCode.ACCOUNT_INACTIVE);
        }

        String presentedHash = OtpService.sha256Hex(request.getRefreshToken());
        if (StringUtils.hasText(user.getRefreshTokenHash())
                && !user.getRefreshTokenHash().equals(presentedHash)) {
            // Replay / mismatch detected: revoke all refresh tokens and bump tokenVersion
            refreshTokenRepository.deleteByUserId(user.getId());
            user.setRefreshTokenHash(null);
            user.setTokenVersion(user.getTokenVersion() + 1);
            userRepository.save(user);
            throw new AppException(ErrorCode.REFRESH_TOKEN_NOT_FOUND,
                    "Refresh token has already been rotated or invalidated.");
        }

        if (user.getGymId() != null && gymRepository != null) {
            gymRepository.findById(user.getGymId()).ifPresent(gym -> {
                if ("SUSPENDED".equalsIgnoreCase(gym.getStatus())) {
                    throw new AppException(ErrorCode.GYM_SUSPENDED);
                }
                if ("EXPIRED".equalsIgnoreCase(gym.getStatus())
                        || (gym.getSubscriptionValidTill() != null
                            && LocalDate.now().isAfter(gym.getSubscriptionValidTill()))) {
                    throw new AppException(ErrorCode.SUBSCRIPTION_EXPIRED);
                }
            });
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
    public StaffResponse createStaff(CreateStaffRequest request) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        String phone = normalizeAndValidatePhone(request.getPhone());

        if (userRepository.existsByPhone(phone)) {
            throw new AppException(ErrorCode.PHONE_ALREADY_REGISTERED,
                    "This phone number is already registered");
        }

        User staff = User.builder()
                .gymId(gymId)
                .name(request.getName().trim())
                .phone(phone)
                .role("STAFF")
                .active(true)
                .status("ACTIVE")
                .tokenVersion(0)
                .build();

        staff = userRepository.save(staff);
        auditLogService.log("STAFF_CREATED", staff.getId(), "name=" + staff.getName());
        log.info("Created STAFF user id={} for gymId={}", staff.getId(), gymId);
        return toStaffResponse(staff);
    }

    @Transactional
    public StaffResponse updateStaff(String staffId, UpdateStaffRequest request) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        User staff = userRepository.findByIdAndGymId(staffId, gymId)
                .filter(u -> "STAFF".equals(u.getRole()))
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND, "Staff member not found"));

        if (request.getName() != null && !request.getName().isBlank()) {
            staff.setName(request.getName().trim());
        }

        if (request.getActive() != null) {
            boolean willBeActive = request.getActive();
            staff.setActive(willBeActive);
            staff.setStatus(willBeActive ? "ACTIVE" : "INACTIVE");
            if (!willBeActive) {
                staff.setTokenVersion(staff.getTokenVersion() + 1);
                staff.setRefreshTokenHash(null);
                refreshTokenRepository.deleteByUserId(staff.getId());
            }
        }

        if (request.getPhone() != null && !request.getPhone().isBlank()) {
            String normalized = normalizeAndValidatePhone(request.getPhone());
            if (!normalized.equals(staff.getPhone())) {
                if (userRepository.existsByPhone(normalized)) {
                    throw new AppException(ErrorCode.PHONE_ALREADY_REGISTERED, "This phone number is already registered");
                }
                staff.setPhone(normalized);
                staff.setTokenVersion(staff.getTokenVersion() + 1);
                staff.setRefreshTokenHash(null);
                refreshTokenRepository.deleteByUserId(staff.getId());
            }
        }

        staff = userRepository.save(staff);
        return toStaffResponse(staff);
    }

    @Transactional
    public void deleteStaff(String staffId) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        User staff = userRepository.findByIdAndGymId(staffId, gymId)
                .filter(u -> "STAFF".equals(u.getRole()))
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND, "Staff member not found"));

        refreshTokenRepository.deleteByUserId(staff.getId());
        userRepository.delete(staff);
    }

    @Transactional
    public StaffResponse toggleStaffStatus(String staffId) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        User staff = userRepository.findByIdAndGymId(staffId, gymId)
                .filter(u -> "STAFF".equals(u.getRole()))
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND, "Staff member not found"));

        boolean willBeActive = !staff.isActive();
        staff.setActive(willBeActive);
        staff.setStatus(willBeActive ? "ACTIVE" : "INACTIVE");

        if (!willBeActive) {
            staff.setTokenVersion(staff.getTokenVersion() + 1);
            staff.setRefreshTokenHash(null);
            refreshTokenRepository.deleteByUserId(staff.getId());
        }

        staff = userRepository.save(staff);
        return toStaffResponse(staff);
    }

    public List<StaffResponse> getStaffList() {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        return userRepository.findByGymIdAndRole(gymId, "STAFF").stream()
                .map(this::toStaffResponse)
                .toList();
    }

    public MeResponse getMe(String userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND, "User not found"));

        String gymName = null;
        String gymType = null;
        String gymCode = null;
        MeResponse.GymSummary gymSummary = null;

        if (user.getGymId() != null) {
            Optional<Gym> gymOpt = gymRepository.findById(user.getGymId());
            if (gymOpt.isPresent()) {
                Gym gym = gymOpt.get();
                gymName = gym.getName();
                if (gym.getGymType() != null) {
                    gymType = gym.getGymType().name();
                }
                boolean isOwner = "OWNER".equalsIgnoreCase(user.getRole());
                if (isOwner) {
                    gymCode = gym.getGymCode();
                }
                gymSummary = MeResponse.GymSummary.builder()
                        .id(gym.getId())
                        .name(gymName)
                        .gymType(gymType)
                        .gymCode(isOwner ? gym.getGymCode() : null)
                        .build();
            }
        }

        List<TrainerTypeResponse> trainerTypes = new ArrayList<>();
        if ("TRAINER".equals(user.getRole()) && user.getTrainerTypeIds() != null && !user.getTrainerTypeIds().isEmpty()) {
            trainerTypes = trainerTypeRepository.findByGymIdAndIdIn(user.getGymId(), user.getTrainerTypeIds()).stream()
                    .map(t -> TrainerTypeResponse.builder()
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
                .email(user.getEmail())
                .role(user.getRole())
                .gymId(user.getGymId())
                .gymName(gymName)
                .gymType(gymType)
                .gymCode(gymCode)
                .gym(gymSummary)
                .active(user.isActive())
                .status(user.getStatus())
                .trainerTypes(trainerTypes)
                .build();
    }

    @Transactional
    public MeResponse updateMe(String userId, UpdateMeRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException(ErrorCode.USER_NOT_FOUND, "User not found"));

        boolean phoneChanged = false;
        if (request.getName() != null && !request.getName().isBlank()) {
            user.setName(request.getName().trim());
        }
        if (request.getPhone() != null && !request.getPhone().isBlank()) {
            String normalizedPhone = normalizeAndValidatePhone(request.getPhone());
            if (!normalizedPhone.equals(user.getPhone())) {
                if (userRepository.existsByPhone(normalizedPhone) || gymRepository.existsByPhone(normalizedPhone)) {
                    throw new AppException(ErrorCode.PHONE_ALREADY_REGISTERED, "This phone number is already registered");
                }
                user.setPhone(normalizedPhone);
                user.setTokenVersion(user.getTokenVersion() + 1);
                user.setRefreshTokenHash(null);
                refreshTokenRepository.deleteByUserId(user.getId());
                phoneChanged = true;
            }
        }
        try {
            user = userRepository.save(user);
        } catch (org.springframework.dao.DuplicateKeyException ex) {
            throw new AppException(ErrorCode.PHONE_ALREADY_REGISTERED, "This phone number is already registered");
        }

        if (phoneChanged && auditLogService != null && "TRAINER".equalsIgnoreCase(user.getRole())) {
            auditLogService.log("TRAINER_PHONE_CHANGED", user.getId(), "Updated trainer phone number");
        }

        // If OWNER and gym exists, update gym ownerName and phone
        final String updatedPhone = user.getPhone();
        final boolean isPhoneChanged = phoneChanged;
        if ("OWNER".equals(user.getRole()) && user.getGymId() != null) {
            gymRepository.findById(user.getGymId()).ifPresent(gym -> {
                if (request.getName() != null && !request.getName().isBlank()) {
                    gym.setOwnerName(request.getName().trim());
                }
                if (isPhoneChanged) {
                    gym.setPhone(updatedPhone);
                }
                gymRepository.save(gym);
            });
        }

        return getMe(user.getId());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private StaffResponse toStaffResponse(User u) {
        return StaffResponse.builder()
                .id(u.getId())
                .gymId(u.getGymId())
                .name(u.getName())
                .phone(u.getPhone())
                .role(u.getRole())
                .active(u.isActive())
                .status(u.getStatus())
                .createdAt(u.getCreatedAt())
                .build();
    }

    private String normalizeAndValidatePhone(String rawPhone) {
        String normalized = SendOtpRequest.normalizePhone(rawPhone);
        if (!StringUtils.hasText(normalized) || !INDIAN_PHONE_PATTERN.matcher(normalized).matches()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Enter a valid 10-digit Indian mobile number");
        }
        return normalized;
    }

    private TokenResponse buildTokenResponse(User user) {
        String accessToken = user.getTokenVersion() > 0
                ? jwtUtil.generateAccessToken(user.getId(), user.getGymId(), user.getRole(), user.getTokenVersion())
                : jwtUtil.generateAccessToken(user.getId(), user.getGymId(), user.getRole());

        int effectiveRefreshDays = refreshTokenExpiryDays > 0 ? refreshTokenExpiryDays : 30;
        String rawRefreshToken = UUID.randomUUID().toString();
        RefreshToken refreshToken = RefreshToken.builder()
                .token(rawRefreshToken)
                .userId(user.getId())
                .gymId(user.getGymId())
                .expiresAt(LocalDateTime.now().plusDays(effectiveRefreshDays))
                .createdAt(LocalDateTime.now())
                .build();

        refreshTokenRepository.save(refreshToken);

        user.setRefreshTokenHash(OtpService.sha256Hex(rawRefreshToken));
        userRepository.save(user);

        return TokenResponse.builder()
                .accessToken(accessToken)
                .refreshToken(rawRefreshToken)
                .tokenType("Bearer")
                .expiresIn(jwtUtil.getAccessTokenExpiryMs() / 1000)
                .userId(user.getId())
                .gymId(user.getGymId())
                .role(user.getRole())
                .build();
    }
}
