package com.gymapp.module.auth.service;

import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.auth.dto.SendOtpRequest;
import com.gymapp.module.auth.dto.SendOtpResponse;
import com.gymapp.module.auth.dto.VerifyOtpRequest;
import com.gymapp.module.auth.dto.VerifyOtpResponse;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.entity.OtpRequest;
import com.gymapp.module.auth.entity.RefreshToken;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.GymRepository;
import com.gymapp.module.auth.repository.OtpRequestRepository;
import com.gymapp.module.auth.repository.RefreshTokenRepository;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.security.JwtUtil;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Handles OTP generation, HMAC-SHA256 hashing with pepper, constant-time verification,
 * rate limiting (cooldown, per-phone hourly, per-IP hourly, 3x invalidation block),
 * and post-verification token issuance.
 *
 * Security rules:
 *  - Never logs OTPs, phone numbers, or tokens.
 *  - Refuses to start if OTP_PEPPER is missing/blank.
 *  - Refuses to start if app.otp.dev-fixed-code is set while the 'prod' profile is active.
 */
@Slf4j
@Service
public class OtpService implements org.springframework.beans.factory.InitializingBean {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final Pattern INDIAN_PHONE_PATTERN = Pattern.compile("^[6-9]\\d{9}$");
    private static final String HMAC_ALGO = "HmacSHA256";
    private static final long HOUR_SECONDS = 3600L;

    private final OtpRequestRepository otpRequestRepository;
    private final UserRepository userRepository;
    private final GymRepository gymRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtUtil jwtUtil;
    private final Environment environment;
    private final SmsSender smsSender;

    @Value("${app.otp.pepper:}")
    private String otpPepper;

    @Value("${app.otp.expiry-seconds:300}")
    private long expirySeconds;

    @Value("${app.otp.resend-cooldown-seconds:30}")
    private long resendCooldownSeconds;

    @Value("${app.otp.max-attempts:5}")
    private int maxAttempts;

    @Value("${app.otp.max-sends-per-phone-per-hour:5}")
    private int maxSendsPerPhonePerHour;

    @Value("${app.otp.max-sends-per-ip-per-hour:10}")
    private int maxSendsPerIpPerHour;

    @Value("${app.otp.max-consecutive-invalidations:3}")
    private int maxConsecutiveInvalidations;

    @Value("${app.otp.phone-block-minutes:30}")
    private long phoneBlockMinutes;

    @Value("${app.otp.dev-fixed-code:}")
    private String devFixedCode;

    @Value("${app.jwt.refresh-token-expiry-days:30}")
    private int refreshTokenExpiryDays;

    private static final String DUMMY_OTP_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
    private static final int MAX_IP_MAP_SIZE = 10_000;

    private final Map<String, IpWindow> ipRateLimitMap = new ConcurrentHashMap<>();
    private final Object[] phoneLocks = new Object[128];

    @Autowired
    public OtpService(
            OtpRequestRepository otpRequestRepository,
            UserRepository userRepository,
            GymRepository gymRepository,
            RefreshTokenRepository refreshTokenRepository,
            JwtUtil jwtUtil,
            Environment environment,
            @Autowired(required = false) SmsSender smsSender) {
        this.otpRequestRepository = otpRequestRepository;
        this.userRepository = userRepository;
        this.gymRepository = gymRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtUtil = jwtUtil;
        this.environment = environment;
        this.smsSender = smsSender;
        for (int i = 0; i < phoneLocks.length; i++) {
            phoneLocks[i] = new Object();
        }
    }

    private Object lockForPhone(String phone) {
        return phoneLocks[Math.floorMod(phone.hashCode(), phoneLocks.length)];
    }

    @Override
    public void afterPropertiesSet() {
        validateConfiguration();
    }

    @PostConstruct
    public void validateConfiguration() {
        String effectivePepper = StringUtils.hasText(otpPepper)
                ? otpPepper
                : (environment != null ? environment.getProperty("app.otp.pepper", environment.getProperty("OTP_PEPPER", "")) : "");
        if (!StringUtils.hasText(effectivePepper)) {
            throw new IllegalStateException(
                    "CRITICAL: Environment variable OTP_PEPPER (app.otp.pepper) is missing or blank. Refusing to start.");
        }
        this.otpPepper = effectivePepper;

        String effectiveDevFixedCode = StringUtils.hasText(devFixedCode)
                ? devFixedCode
                : (environment != null ? environment.getProperty("app.otp.dev-fixed-code", environment.getProperty("OTP_DEV_FIXED_CODE", "")) : "");
        boolean isProd = environment != null && (
                environment.acceptsProfiles(Profiles.of("prod", "production"))
                || java.util.Arrays.asList(environment.getProperty("spring.profiles.active", "").split(","))
                        .stream().map(String::trim)
                        .anyMatch(p -> "prod".equalsIgnoreCase(p) || "production".equalsIgnoreCase(p)));

        if (StringUtils.hasText(effectiveDevFixedCode)) {
            this.devFixedCode = effectiveDevFixedCode.trim();
            if (isProd) {
                throw new IllegalStateException(
                        "CRITICAL: Property 'app.otp.dev-fixed-code' must not be set when the 'prod' profile is active!");
            }
            if (environment != null && !environment.acceptsProfiles(Profiles.of("(dev | test) & !prod & !production"))) {
                throw new IllegalStateException(
                        "Property 'app.otp.dev-fixed-code' is only permitted under the 'dev' profile.");
            }
            if (!this.devFixedCode.matches("^\\d{6}$")) {
                throw new IllegalStateException(
                        "Property 'app.otp.dev-fixed-code' must be a 6-digit numeric code.");
            }
        }

        if (isProd) {
            String smsProvider = environment != null
                    ? environment.getProperty("app.sms.provider", environment.getProperty("SMS_PROVIDER", ""))
                    : "";
            if (!"msg91".equalsIgnoreCase(smsProvider.trim())) {
                throw new IllegalStateException(
                        "CRITICAL: Property 'app.sms.provider' must be configured as 'msg91' when the 'prod' profile is active! (found: '" + smsProvider + "')");
            }

            String authKey = environment.getProperty("app.sms.msg91.auth-key", environment.getProperty("MSG91_AUTH_KEY", ""));
            String templateId = environment.getProperty("app.sms.msg91.template-id", environment.getProperty("MSG91_TEMPLATE_ID", ""));
            if (!StringUtils.hasText(templateId)) {
                templateId = environment.getProperty("MSG91_DLT_TEMPLATE_ID", "");
            }
            String senderId = environment.getProperty("app.sms.msg91.sender-id", environment.getProperty("MSG91_SENDER_ID", ""));
            String entityId = environment.getProperty("app.sms.msg91.entity-id", environment.getProperty("MSG91_ENTITY_ID", ""));
            if (!StringUtils.hasText(entityId)) {
                entityId = environment.getProperty("MSG91_DLT_ENTITY_ID", "");
            }

            if (!StringUtils.hasText(authKey)) {
                throw new IllegalStateException("CRITICAL: MSG91 auth key (app.sms.msg91.auth-key / MSG91_AUTH_KEY) is missing in 'prod' profile!");
            }
            if (!StringUtils.hasText(templateId)) {
                throw new IllegalStateException("CRITICAL: MSG91 DLT template ID (app.sms.msg91.template-id / MSG91_TEMPLATE_ID) is missing in 'prod' profile!");
            }
            if (!StringUtils.hasText(senderId)) {
                throw new IllegalStateException("CRITICAL: MSG91 sender ID (app.sms.msg91.sender-id / MSG91_SENDER_ID) is missing in 'prod' profile!");
            }
            if (!StringUtils.hasText(entityId)) {
                throw new IllegalStateException("CRITICAL: MSG91 entity ID (app.sms.msg91.entity-id / MSG91_ENTITY_ID) is missing in 'prod' profile!");
            }
        }
    }

    /**
     * Generates and sends an OTP to the given phone number.
     * Always returns the exact same response whether or not the phone is registered.
     */
    public SendOtpResponse sendOtp(SendOtpRequest request, String clientIp) {
        String phone = normalizeAndValidatePhone(request != null ? request.getPhone() : null);
        Instant now = Instant.now();

        String plainOtp;
        synchronized (lockForPhone(phone)) {
            OtpRequest otpRequest = otpRequestRepository.findByPhone(phone)
                    .orElseGet(() -> OtpRequest.builder()
                            .phone(phone)
                            .attempts(0)
                            .sendCountInWindow(0)
                            .consecutiveInvalidations(0)
                            .build());

            // 1. Check 30-minute phone block (after 3 invalidated OTPs in a row)
            if (otpRequest.getBlockedUntil() != null) {
                if (now.isBefore(otpRequest.getBlockedUntil())) {
                    long retryAfter = computeRetryAfterSeconds(now, otpRequest.getBlockedUntil());
                    throw new AppException(
                            ErrorCode.RATE_LIMITED,
                            "Phone number is temporarily blocked due to too many invalidated OTPs.",
                            retryAfter);
                } else {
                    otpRequest.setBlockedUntil(null);
                    otpRequest.setConsecutiveInvalidations(0);
                }
            }

            // 2. Check 30-second resend cooldown
            if (otpRequest.getLastSentAt() != null) {
                Instant resendAllowedAt = otpRequest.getLastSentAt().plusSeconds(resendCooldownSeconds);
                if (now.isBefore(resendAllowedAt)) {
                    long retryAfter = computeRetryAfterSeconds(now, resendAllowedAt);
                    throw new AppException(
                            ErrorCode.RATE_LIMITED,
                            "Please wait before requesting another OTP.",
                            retryAfter);
                }
            }

            // 3. Check per-phone hourly limit (max 5 sends per phone per hour)
            if (otpRequest.getWindowStart() == null
                    || !now.isBefore(otpRequest.getWindowStart().plusSeconds(HOUR_SECONDS))) {
                otpRequest.setWindowStart(now);
                otpRequest.setSendCountInWindow(0);
            }

            if (otpRequest.getSendCountInWindow() >= maxSendsPerPhonePerHour) {
                Instant windowEndsAt = otpRequest.getWindowStart().plusSeconds(HOUR_SECONDS);
                long retryAfter = computeRetryAfterSeconds(now, windowEndsAt);
                throw new AppException(
                        ErrorCode.RATE_LIMITED,
                        "Maximum OTP requests per hour exceeded for this phone number.",
                        retryAfter);
            }

            // 4. Check per-IP hourly limit (max 10 sends per IP per hour)
            enforceAndRecordIpRateLimit(clientIp, now);

            // 5. Generate 6-digit OTP (or use DevFixedOtp if active) and hash with HMAC-SHA256
            plainOtp = generateOtp();
            String otpHash = hashOtp(plainOtp);

            otpRequest.setOtpHash(otpHash);
            otpRequest.setExpiresAt(now.plusSeconds(expirySeconds));
            otpRequest.setAttempts(0);
            otpRequest.setSendCountInWindow(otpRequest.getSendCountInWindow() + 1);
            otpRequest.setLastSentAt(now);

            otpRequestRepository.save(otpRequest);
        }

        if (smsSender != null) {
            smsSender.sendOtp(phone, plainOtp);
        }

        return SendOtpResponse.builder()
                .resendAfterSeconds(resendCooldownSeconds)
                .expiresInSeconds(expirySeconds)
                .build();
    }

    /**
     * Verifies an OTP in constant time and issues either auth tokens (existing active user)
     * or a 15-minute REGISTER-scoped registrationToken (new user).
     */
    public VerifyOtpResponse verifyOtp(VerifyOtpRequest request) {
        String phone = normalizeAndValidatePhone(request != null ? request.getPhone() : null);
        String candidateOtp = (request != null && request.getOtp() != null) ? request.getOtp().trim() : "";
        Instant now = Instant.now();

        synchronized (lockForPhone(phone)) {
            OtpRequest otpRequest = otpRequestRepository.findByPhone(phone).orElse(null);

            // Always compute HMAC-SHA256 first to prevent timing side-channels revealing whether an OTP was sent
            String candidateHash = hashOtp(candidateOtp);

            // 1. Check if phone is currently blocked for 30 minutes
            if (otpRequest != null && otpRequest.getBlockedUntil() != null) {
                if (now.isBefore(otpRequest.getBlockedUntil())) {
                    long retryAfter = computeRetryAfterSeconds(now, otpRequest.getBlockedUntil());
                    throw new AppException(
                            ErrorCode.RATE_LIMITED,
                            "Phone number is temporarily blocked due to too many invalidated OTPs.",
                            retryAfter);
                } else {
                    otpRequest.setBlockedUntil(null);
                    otpRequest.setConsecutiveInvalidations(0);
                }
            }

            // 2. Check if OTP exists, is not invalidated, is not expired, and has remaining attempts
            if (otpRequest == null
                    || !StringUtils.hasText(otpRequest.getOtpHash())
                    || otpRequest.getExpiresAt() == null
                    || now.isAfter(otpRequest.getExpiresAt())
                    || otpRequest.getAttempts() >= maxAttempts) {
                constantTimeEquals(DUMMY_OTP_HASH, candidateHash);
                throw new AppException(ErrorCode.INVALID_OTP);
            }

            // 3. Constant-time HMAC-SHA256 comparison
            boolean matches = constantTimeEquals(otpRequest.getOtpHash(), candidateHash);

            if (!matches) {
                int newAttempts = otpRequest.getAttempts() + 1;
                otpRequest.setAttempts(newAttempts);

                if (newAttempts >= maxAttempts) {
                    // Invalidate this OTP so a new one must be requested
                    otpRequest.setOtpHash(null);
                    int streak = otpRequest.getConsecutiveInvalidations() + 1;
                    otpRequest.setConsecutiveInvalidations(streak);

                    if (streak >= maxConsecutiveInvalidations) {
                        Instant blockedUntil = now.plusSeconds(phoneBlockMinutes * 60L);
                        otpRequest.setBlockedUntil(blockedUntil);
                        if (otpRequest.getExpiresAt() == null || otpRequest.getExpiresAt().isBefore(blockedUntil)) {
                            otpRequest.setExpiresAt(blockedUntil);
                        }
                    }
                }

                otpRequestRepository.save(otpRequest);
                throw new AppException(ErrorCode.INVALID_OTP);
            }

            // 4. OTP matched — consume OTP and reset failure counters while preserving send window
            otpRequest.setOtpHash(null);
            otpRequest.setAttempts(0);
            otpRequest.setConsecutiveInvalidations(0);
            otpRequest.setBlockedUntil(null);
            otpRequestRepository.save(otpRequest);
        }

        // 5. Look up user by phone
        Optional<User> userOpt = userRepository.findByPhone(phone);

        if (userOpt.isEmpty()) {
            String registrationToken = jwtUtil.generateRegistrationToken(phone);
            return VerifyOtpResponse.builder()
                    .isNewUser(true)
                    .registrationToken(registrationToken)
                    .build();
        }

        User user = userOpt.get();

        // Check if user is INACTIVE
        if (!user.isActive()
                || "INACTIVE".equalsIgnoreCase(user.getStatus())
                || (user.getStatus() != null && !"ACTIVE".equalsIgnoreCase(user.getStatus()))) {
            throw new AppException(ErrorCode.ACCOUNT_INACTIVE);
        }

        // Check gym status (suspension / subscription expiry) if user belongs to a gym
        String gymName = null;
        if (user.getGymId() != null) {
            Gym gym = gymRepository.findById(user.getGymId())
                    .orElseThrow(() -> new AppException(ErrorCode.GYM_NOT_FOUND));

            if ("SUSPENDED".equalsIgnoreCase(gym.getStatus())) {
                throw new AppException(ErrorCode.GYM_SUSPENDED);
            }

            if ("EXPIRED".equalsIgnoreCase(gym.getStatus())
                    || (gym.getSubscriptionValidTill() != null
                        && LocalDate.now().isAfter(gym.getSubscriptionValidTill()))) {
                throw new AppException(ErrorCode.SUBSCRIPTION_EXPIRED);
            }

            gymName = gym.getName();
        }

        // Issue access token (30 min) and refresh token (30 days)
        String accessToken = jwtUtil.generateAccessToken(
                user.getId(), user.getGymId(), user.getRole(), user.getTokenVersion());

        String rawRefreshToken = UUID.randomUUID().toString();
        RefreshToken refreshToken = RefreshToken.builder()
                .token(rawRefreshToken)
                .userId(user.getId())
                .gymId(user.getGymId())
                .expiresAt(LocalDateTime.now().plusDays(refreshTokenExpiryDays))
                .createdAt(LocalDateTime.now())
                .build();
        refreshTokenRepository.save(refreshToken);

        user.setRefreshTokenHash(sha256Hex(rawRefreshToken));
        userRepository.save(user);

        return VerifyOtpResponse.builder()
                .isNewUser(false)
                .accessToken(accessToken)
                .refreshToken(rawRefreshToken)
                .user(VerifyOtpResponse.UserSummary.builder()
                        .id(user.getId())
                        .name(user.getName())
                        .role(user.getRole())
                        .gymId(user.getGymId())
                        .gymName(gymName)
                        .build())
                .build();
    }

    /**
     * Invalidates any active OTP hash for a phone number (e.g. when an owner registers
     * a trainer/staff with that phone or after registration completes) while preserving
     * rate-limit windows.
     */
    public void invalidatePendingOtpForPhone(String phone) {
        if (!StringUtils.hasText(phone) || otpRequestRepository == null) {
            return;
        }
        synchronized (lockForPhone(phone)) {
            otpRequestRepository.findByPhone(phone).ifPresent(otpReq -> {
                if (otpReq.getOtpHash() != null) {
                    otpReq.setOtpHash(null);
                    otpReq.setAttempts(0);
                    otpRequestRepository.save(otpReq);
                }
            });
        }
    }

    public static String sha256Hex(String value) {
        if (value == null) {
            return null;
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to compute SHA-256", e);
        }
    }

    /**
     * Computes HMAC-SHA256 of the given OTP using the configured secret pepper.
     */
    public String hashOtp(String otp) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGO);
            SecretKeySpec keySpec = new SecretKeySpec(otpPepper.getBytes(StandardCharsets.UTF_8), HMAC_ALGO);
            mac.init(keySpec);
            byte[] digest = mac.doFinal(otp.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to compute HMAC-SHA256 for OTP", e);
        }
    }

    /**
     * Constant-time comparison of two hash strings.
     */
    public boolean constantTimeEquals(String expectedHash, String actualHash) {
        if (expectedHash == null || actualHash == null) {
            return false;
        }
        return MessageDigest.isEqual(
                expectedHash.getBytes(StandardCharsets.UTF_8),
                actualHash.getBytes(StandardCharsets.UTF_8));
    }

    public void resetIpRateLimits() {
        ipRateLimitMap.clear();
    }

    private String generateOtp() {
        if (smsSender != null && smsSender.getFixedOtp().isPresent()) {
            return smsSender.getFixedOtp().get();
        }
        if (StringUtils.hasText(devFixedCode)) {
            return devFixedCode.trim();
        }
        int code = SECURE_RANDOM.nextInt(1_000_000);
        return String.format("%06d", code);
    }

    private String normalizeAndValidatePhone(String rawPhone) {
        String normalized = SendOtpRequest.normalizePhone(rawPhone);
        if (!StringUtils.hasText(normalized) || !INDIAN_PHONE_PATTERN.matcher(normalized).matches()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Enter a valid 10-digit Indian mobile number");
        }
        return normalized;
    }

    private void enforceAndRecordIpRateLimit(String clientIp, Instant now) {
        String ipKey = StringUtils.hasText(clientIp) ? clientIp.trim() : "unknown";

        synchronized (ipRateLimitMap) {
            if (ipRateLimitMap.size() >= MAX_IP_MAP_SIZE) {
                ipRateLimitMap.entrySet().removeIf(e -> !now.isBefore(e.getValue().windowStart.plusSeconds(HOUR_SECONDS)));
            }

            IpWindow window = ipRateLimitMap.get(ipKey);
            if (window == null || !now.isBefore(window.windowStart.plusSeconds(HOUR_SECONDS))) {
                window = new IpWindow(now, 0);
                ipRateLimitMap.put(ipKey, window);
            }

            if (window.count >= maxSendsPerIpPerHour) {
                Instant resetAt = window.windowStart.plusSeconds(HOUR_SECONDS);
                long retryAfter = computeRetryAfterSeconds(now, resetAt);
                throw new AppException(
                        ErrorCode.RATE_LIMITED,
                        "Maximum OTP requests per hour exceeded from this IP.",
                        retryAfter);
            }

            window.count++;
        }
    }

    private long computeRetryAfterSeconds(Instant now, Instant target) {
        long millis = Duration.between(now, target).toMillis();
        if (millis <= 0) {
            return 1L;
        }
        return Math.max(1L, (long) Math.ceil(millis / 1000.0));
    }

    private static class IpWindow {
        final Instant windowStart;
        int count;

        IpWindow(Instant windowStart, int count) {
            this.windowStart = windowStart;
            this.count = count;
        }
    }
}
