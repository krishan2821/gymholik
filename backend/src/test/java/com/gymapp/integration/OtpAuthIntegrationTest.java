package com.gymapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.config.DatabaseStartupMigration;
import com.gymapp.module.auth.dto.CompleteRegistrationRequest;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.entity.OtpRequest;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.GymRepository;
import com.gymapp.module.auth.repository.OtpRequestRepository;
import com.gymapp.module.auth.repository.RefreshTokenRepository;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.auth.service.DevFixedOtp;
import com.gymapp.module.auth.service.OtpService;
import com.gymapp.module.plan.repository.PlanRepository;
import com.gymapp.module.plan.service.PlanService;
import com.gymapp.module.trainer.repository.TrainerTypeRepository;
import com.gymapp.module.trainer.service.TrainerTypeService;
import com.gymapp.security.JwtUtil;
import io.jsonwebtoken.Claims;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestPropertySource(properties = {
        "app.otp.dev-fixed-code=123456"
})
public class OtpAuthIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OtpRequestRepository otpRequestRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GymRepository gymRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PlanRepository planRepository;

    @Autowired
    private TrainerTypeRepository trainerTypeRepository;

    @Autowired
    private DatabaseStartupMigration databaseStartupMigration;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void cleanOtpRequests() {
        otpRequestRepository.deleteAll();
    }

    @Test
    @DisplayName("1. Send then verify OTP succeeds for existing ACTIVE user and new unregistered number (+91 stripped)")
    void sendAndVerify_existingAndNewNumbers_succeeds() throws Exception {
        // Register a gym + owner via OTP complete-registration (existing user with phone 9876500001)
        String existingPhone = "9876500001";
        registerGymViaOtpToken(mockMvc, objectMapper, "Iron Paradise", "Rohan Sharma", existingPhone, "rohan@ironparadise.in");

        // 1a. Send OTP with +91 prefix for existing user
        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"+919876500001\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.message", is("OTP sent")))
                .andExpect(jsonPath("$.data.resendAfterSeconds", is(30)))
                .andExpect(jsonPath("$.data.expiresInSeconds", is(300)));

        // Ensure plain OTP is NEVER stored in otp_requests
        OtpRequest stored = otpRequestRepository.findByPhone(existingPhone).orElseThrow();
        assertThat(stored.getOtpHash()).isNotBlank().isNotEqualTo("123456").hasSize(64);
        assertThat(stored.getExpiresAt()).isAfter(Instant.now());

        // Verify TTL index exists on otp_requests.expiresAt
        List<IndexInfo> indexes = mongoTemplate.indexOps("otp_requests").getIndexInfo();
        assertThat(indexes).anyMatch(idx -> "otp_expires_ttl_idx".equals(idx.getName()) && idx.getExpireAfter().isPresent());

        // Verify OTP for existing user
        MvcResult verifyExistingRes = mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"+919876500001\", \"otp\": \"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.message", is("Authentication successful")))
                .andExpect(jsonPath("$.data.isNewUser", is(false)))
                .andExpect(jsonPath("$.data.accessToken", not(emptyOrNullString())))
                .andExpect(jsonPath("$.data.refreshToken", not(emptyOrNullString())))
                .andExpect(jsonPath("$.data.user.name", is("Rohan Sharma")))
                .andExpect(jsonPath("$.data.user.role", is("OWNER")))
                .andExpect(jsonPath("$.data.user.gymId", not(emptyOrNullString())))
                .andExpect(jsonPath("$.data.user.gymName", is("Iron Paradise")))
                .andExpect(jsonPath("$.data.registrationToken").doesNotExist())
                .andReturn();

        JsonNode existingData = objectMapper.readTree(verifyExistingRes.getResponse().getContentAsString()).path("data");
        String accessToken = existingData.path("accessToken").asText();

        // Access token can call tenant endpoint
        mockMvc.perform(get("/api/members")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());

        // 1b. Send and verify OTP for a brand-new unregistered number
        String newPhone = "9876500002";
        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + newPhone + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.message", is("OTP sent")));

        MvcResult verifyNewRes = mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + newPhone + "\", \"otp\": \"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.message", is("Verified")))
                .andExpect(jsonPath("$.data.isNewUser", is(true)))
                .andExpect(jsonPath("$.data.registrationToken", not(emptyOrNullString())))
                .andExpect(jsonPath("$.data.accessToken").doesNotExist())
                .andExpect(jsonPath("$.data.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.data.user").doesNotExist())
                .andReturn();

        String registrationToken = objectMapper.readTree(verifyNewRes.getResponse().getContentAsString())
                .path("data").path("registrationToken").asText();

        Claims regClaims = jwtUtil.validateAndExtractClaims(registrationToken);
        assertThat(regClaims.get("scope", String.class)).isEqualTo("REGISTER");
        assertThat(regClaims.get("phone", String.class)).isEqualTo(newPhone);
        assertThat(regClaims.get("gymId")).isNull();
        assertThat(regClaims.get("role")).isNull();
    }

    @Test
    @DisplayName("2. send-otp returns the exact same response for registered vs unregistered phone numbers")
    void sendOtp_sameResponseForRegisteredAndUnregistered() throws Exception {
        String registeredPhone = "9876500011";
        String unregisteredPhone = "9876500012";

        if (!userRepository.existsByPhone(registeredPhone)) {
            registerGymViaOtpToken(mockMvc, objectMapper, "Pulse Gym", "Owner Pulse", registeredPhone, null);
        }

        MvcResult resRegistered = mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + registeredPhone + "\"}"))
                .andExpect(status().isOk())
                .andReturn();

        MvcResult resUnregistered = mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + unregisteredPhone + "\"}"))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(resRegistered.getResponse().getContentAsString())
                .isEqualTo(resUnregistered.getResponse().getContentAsString());
    }

    @Test
    @DisplayName("3. Wrong OTP 5 times invalidates the OTP so even the correct OTP fails on the 6th attempt")
    void verifyOtp_wrongFiveTimes_invalidatesOtp() throws Exception {
        String phone = "9876500021";

        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + phone + "\"}"))
                .andExpect(status().isOk());

        // 5 wrong attempts -> each returns 401 INVALID_OTP
        for (int i = 1; i <= 5; i++) {
            mockMvc.perform(post("/api/auth/verify-otp")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"phone\": \"" + phone + "\", \"otp\": \"000000\"}"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error", is("INVALID_OTP")));
        }

        // 6th attempt with the CORRECT OTP ("123456") must fail with 401 INVALID_OTP because it was invalidated
        mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + phone + "\", \"otp\": \"123456\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("INVALID_OTP")));
    }

    @Test
    @DisplayName("4. Expired OTP returns 401 INVALID_OTP without distinguishing wrong vs expired")
    void verifyOtp_expiredOtp_returns401InvalidOtp() throws Exception {
        String phone = "9876500031";

        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + phone + "\"}"))
                .andExpect(status().isOk());

        // Expire the OTP in MongoDB
        OtpRequest req = otpRequestRepository.findByPhone(phone).orElseThrow();
        req.setExpiresAt(Instant.now().minusSeconds(10));
        otpRequestRepository.save(req);

        MvcResult expiredRes = mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + phone + "\", \"otp\": \"123456\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("INVALID_OTP")))
                .andReturn();

        // Compare with a wrong OTP response on another number to ensure identical error message/code
        String phone2 = "9876500032";
        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + phone2 + "\"}"))
                .andExpect(status().isOk());

        MvcResult wrongRes = mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + phone2 + "\", \"otp\": \"999999\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("INVALID_OTP")))
                .andReturn();

        assertThat(expiredRes.getResponse().getContentAsString())
                .isEqualTo(wrongRes.getResponse().getContentAsString());
    }

    @Test
    @DisplayName("5. Resend before 30 seconds is rejected with 429 RATE_LIMITED and retryAfterSeconds")
    void sendOtp_resendBefore30Seconds_rejectedWith429() throws Exception {
        String phone = "9876500041";

        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + phone + "\"}"))
                .andExpect(status().isOk());

        // Immediate resend (< 30s) -> 429 RATE_LIMITED with retryAfterSeconds
        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + phone + "\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error", is("RATE_LIMITED")))
                .andExpect(jsonPath("$.retryAfterSeconds", allOf(greaterThan(0), lessThanOrEqualTo(30))));
    }

    @Test
    @DisplayName("6a. Rate limit: maximum 5 OTP sends per phone per hour")
    void rateLimit_max5SendsPerPhonePerHour() throws Exception {
        String phone = "9876500051";

        for (int i = 1; i <= 5; i++) {
            mockMvc.perform(post("/api/auth/send-otp")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"phone\": \"" + phone + "\"}"))
                    .andExpect(status().isOk());

            OtpRequest otpReq = otpRequestRepository.findByPhone(phone).orElseThrow();
            otpReq.setLastSentAt(Instant.now().minusSeconds(31));
            otpRequestRepository.save(otpReq);
        }

        // 6th send within the hour -> 429 RATE_LIMITED
        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + phone + "\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error", is("RATE_LIMITED")))
                .andExpect(jsonPath("$.retryAfterSeconds", greaterThan(0)));
    }

    @Test
    @DisplayName("6b. Rate limit: maximum 10 OTP sends per IP per hour")
    void rateLimit_max10SendsPerIpPerHour() throws Exception {
        String clientIp = "203.0.113.55";

        for (int i = 0; i < 10; i++) {
            String phone = String.format("98765001%02d", i);
            mockMvc.perform(post("/api/auth/send-otp")
                            .with(req -> {
                                req.setRemoteAddr(clientIp);
                                return req;
                            })
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"phone\": \"" + phone + "\"}"))
                    .andExpect(status().isOk());
        }

        // 11th request from same IP -> 429 RATE_LIMITED
        mockMvc.perform(post("/api/auth/send-otp")
                        .with(req -> {
                            req.setRemoteAddr(clientIp);
                            return req;
                        })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"9876500199\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error", is("RATE_LIMITED")))
                .andExpect(jsonPath("$.retryAfterSeconds", greaterThan(0)));
    }

    @Test
    @DisplayName("6c. Rate limit: 3 invalidated OTPs in a row blocks the phone for 30 minutes")
    void rateLimit_threeInvalidatedOtpsInARow_blocksPhoneFor30Minutes() throws Exception {
        String phone = "9876500061";

        for (int round = 1; round <= 3; round++) {
            mockMvc.perform(post("/api/auth/send-otp")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"phone\": \"" + phone + "\"}"))
                    .andExpect(status().isOk());

            for (int attempt = 1; attempt <= 5; attempt++) {
                mockMvc.perform(post("/api/auth/verify-otp")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"phone\": \"" + phone + "\", \"otp\": \"000000\"}"))
                        .andExpect(status().isUnauthorized())
                        .andExpect(jsonPath("$.error", is("INVALID_OTP")));
            }

            OtpRequest otpReq = otpRequestRepository.findByPhone(phone).orElseThrow();
            otpReq.setLastSentAt(Instant.now().minusSeconds(31));
            otpRequestRepository.save(otpReq);
        }

        // Now the phone has 3 invalidated OTPs in a row -> blocked for 30 minutes (1800s)
        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + phone + "\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error", is("RATE_LIMITED")))
                .andExpect(jsonPath("$.retryAfterSeconds", greaterThan(1700)));

        mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + phone + "\", \"otp\": \"123456\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error", is("RATE_LIMITED")))
                .andExpect(jsonPath("$.retryAfterSeconds", greaterThan(1700)));
    }

    @Test
    @DisplayName("7. registrationToken cannot call any tenant or user endpoint")
    void registrationToken_rejectedOnAllTenantEndpoints() throws Exception {
        String newPhone = "9876500071";

        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + newPhone + "\"}"))
                .andExpect(status().isOk());

        MvcResult verifyRes = mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + newPhone + "\", \"otp\": \"123456\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String regToken = "Bearer " + objectMapper.readTree(verifyRes.getResponse().getContentAsString())
                .path("data").path("registrationToken").asText();

        mockMvc.perform(get("/api/members").header("Authorization", regToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/members")
                        .header("Authorization", regToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test\",\"phone\":\"9876500072\",\"planId\":\"p1\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/plans").header("Authorization", regToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/dashboard").header("Authorization", regToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/attendance").header("Authorization", regToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/payments").header("Authorization", regToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/gym").header("Authorization", regToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/staff").header("Authorization", regToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/trainers").header("Authorization", regToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/audit-logs").header("Authorization", regToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/auth/me").header("Authorization", regToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("8. Inactive user, suspended gym, and expired gym subscription return appropriate error codes on verify-otp")
    void verifyOtp_inactiveUserAndGymStatusChecks() throws Exception {
        String ownerPhone = "9876500081";
        JsonNode regData = registerGymViaOtpToken(
                mockMvc, objectMapper, "Status Test Gym", "Status Owner", ownerPhone, null);
        String gymId = regData.path("user").path("gymId").asText();

        // 8a. Inactive user -> 403 ACCOUNT_INACTIVE
        User owner = userRepository.findByPhone(ownerPhone).orElseThrow();
        owner.setActive(false);
        owner.setStatus("INACTIVE");
        userRepository.save(owner);

        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + ownerPhone + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + ownerPhone + "\", \"otp\": \"123456\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", is("ACCOUNT_INACTIVE")));

        // Reactivate user, suspend gym -> 403 GYM_SUSPENDED
        owner.setActive(true);
        owner.setStatus("ACTIVE");
        userRepository.save(owner);

        Gym gym = gymRepository.findById(gymId).orElseThrow();
        gym.setStatus("SUSPENDED");
        gymRepository.save(gym);

        OtpRequest otpReq = otpRequestRepository.findByPhone(ownerPhone).orElseThrow();
        otpReq.setLastSentAt(Instant.now().minusSeconds(31));
        otpRequestRepository.save(otpReq);

        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + ownerPhone + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + ownerPhone + "\", \"otp\": \"123456\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error", is("GYM_SUSPENDED")));

        // Expire gym subscription -> 402 SUBSCRIPTION_EXPIRED
        gym.setStatus("ACTIVE");
        gym.setSubscriptionValidTill(LocalDate.now().minusDays(1));
        gymRepository.save(gym);

        otpReq = otpRequestRepository.findByPhone(ownerPhone).orElseThrow();
        otpReq.setLastSentAt(Instant.now().minusSeconds(31));
        otpRequestRepository.save(otpReq);

        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + ownerPhone + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + ownerPhone + "\", \"otp\": \"123456\"}"))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.error", is("SUBSCRIPTION_EXPIRED")));
    }

    @Test
    @DisplayName("9. App refuses to start when app.otp.dev-fixed-code is set under prod profile or when OTP_PEPPER is missing")
    void appRefusesToStart_withDevFixedCodeInProd_orMissingPepper() {
        new ApplicationContextRunner()
                .withPropertyValues(
                        "spring.profiles.active=prod",
                        "app.otp.dev-fixed-code=123456"
                )
                .withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("prod"))
                .withBean(DevFixedOtp.class, () -> new DevFixedOtp("123456",
                        new org.springframework.mock.env.MockEnvironment().withProperty("spring.profiles.active", "prod")
                ))
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .rootCause()
                            .isInstanceOf(IllegalStateException.class)
                            .hasMessageContaining("app.otp.dev-fixed-code");
                });

        org.springframework.mock.env.MockEnvironment prodEnvWithFixedCode = new org.springframework.mock.env.MockEnvironment();
        prodEnvWithFixedCode.setActiveProfiles("prod");
        prodEnvWithFixedCode.setProperty("app.otp.pepper", "secret-pepper");
        prodEnvWithFixedCode.setProperty("app.otp.dev-fixed-code", "123456");

        new ApplicationContextRunner()
                .withPropertyValues(
                        "spring.profiles.active=prod",
                        "app.otp.pepper=secret-pepper",
                        "app.otp.dev-fixed-code=123456"
                )
                .withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles("prod"))
                .withBean(OtpService.class,
                        () -> new OtpService(otpRequestRepository, userRepository, gymRepository, refreshTokenRepository, jwtUtil,
                                prodEnvWithFixedCode, null))
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .rootCause()
                            .isInstanceOf(IllegalStateException.class)
                            .hasMessageContaining("app.otp.dev-fixed-code");
                });

        new ApplicationContextRunner()
                .withPropertyValues(
                        "app.otp.pepper="
                )
                .withBean(OtpService.class,
                        () -> new OtpService(otpRequestRepository, userRepository, gymRepository, refreshTokenRepository, jwtUtil,
                                new org.springframework.mock.env.MockEnvironment(), null))
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .rootCause()
                            .isInstanceOf(IllegalStateException.class)
                            .hasMessageContaining("OTP_PEPPER");
                });
    }

    @Test
    @DisplayName("10. Complete registration via OTP creates Gym (14-day TRIAL, default plans, default trainer types, internal receiptPrefix) and OWNER user, taking phone ONLY from token")
    void completeRegistration_createsGymDefaultsAndOwner_phoneOnlyFromToken() throws Exception {
        String verifiedPhone = "9876500201";
        String spoofedBodyPhone = "9876599999";

        // Step 1: Send OTP
        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + verifiedPhone + "\"}"))
                .andExpect(status().isOk());

        // Step 2: Verify OTP -> get registrationToken
        MvcResult verifyRes = mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + verifiedPhone + "\", \"otp\": \"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isNewUser", is(true)))
                .andReturn();

        String regToken = objectMapper.readTree(verifyRes.getResponse().getContentAsString())
                .path("data").path("registrationToken").asText();

        // Step 3: Call complete-registration (including a spoofed phone in body to prove it's ignored)
        CompleteRegistrationRequest regReq = CompleteRegistrationRequest.builder()
                .gymName("Titan Fitness")
                .gymType(com.gymapp.module.auth.entity.GymType.COMMERCIAL)
                .ownerName("Vikram Rathore")
                .email("vikram@titan.in")
                .address(CompleteRegistrationRequest.AddressDto.builder()
                        .line1("123 Test Street")
                        .state("Maharashtra")
                        .district("Mumbai")
                        .pincode("400001")
                        .build())
                .acceptedTerms(true)
                .termsVersion("1.0")
                .build();

        MvcResult completeRes = mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + regToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(regReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.isNewUser", is(false)))
                .andExpect(jsonPath("$.data.accessToken", not(emptyOrNullString())))
                .andExpect(jsonPath("$.data.refreshToken", not(emptyOrNullString())))
                .andExpect(jsonPath("$.data.user.name", is("Vikram Rathore")))
                .andExpect(jsonPath("$.data.user.role", is("OWNER")))
                .andExpect(jsonPath("$.data.user.gymName", is("Titan Fitness")))
                .andExpect(jsonPath("$.data.gym.gymCode", not(emptyOrNullString())))
                .andExpect(jsonPath("$.data.gym.gymType", is("COMMERCIAL")))
                .andReturn();

        JsonNode data = objectMapper.readTree(completeRes.getResponse().getContentAsString()).path("data");
        String gymId = data.path("user").path("gymId").asText();
        String accessToken = data.path("accessToken").asText();

        // Verify phone came ONLY from the JWT token, never from the body
        assertThat(userRepository.findByPhone(verifiedPhone)).isPresent();
        assertThat(userRepository.findByPhone(spoofedBodyPhone)).isEmpty();

        User owner = userRepository.findByPhone(verifiedPhone).orElseThrow();
        assertThat(owner.getEmail()).isEqualTo("vikram@titan.in");
        assertThat(owner.getStatus()).isEqualTo("ACTIVE");
        assertThat(owner.isActive()).isTrue();

        // Verify Gym has 14-day TRIAL and unique gymCode
        Gym gym = gymRepository.findById(gymId).orElseThrow();
        assertThat(gym.getStatus()).isEqualTo("TRIAL");
        assertThat(gym.getSubscriptionValidTill()).isEqualTo(LocalDate.now().plusDays(14));
        assertThat(gym.getGymCode()).isNotBlank();

        // Verify default plans and default trainer types were seeded
        assertThat(planRepository.findByGymIdAndActive(gymId, true))
                .hasSize(PlanService.DEFAULT_PLANS.size());
        assertThat(trainerTypeRepository.findByGymId(gymId))
                .hasSize(TrainerTypeService.DEFAULT_TYPES.size());

        // Verify OWNER sees gymCode and gymType in /api/auth/me
        MvcResult meRes = mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gymCode", is(gym.getGymCode())))
                .andExpect(jsonPath("$.data.gymType", is("COMMERCIAL")))
                .andExpect(jsonPath("$.data.receiptPrefix").doesNotExist())
                .andExpect(jsonPath("$.data.email", is("vikram@titan.in")))
                .andReturn();
    }

    @Test
    @DisplayName("11. Complete registration: single-use registrationToken and 409 Conflict when phone already exists (race condition)")
    void completeRegistration_singleUseToken_andRaceCondition409() throws Exception {
        // 11a. Single-use registration token enforcement
        String phone1 = "9876500211";
        String regToken1 = jwtUtil.generateRegistrationToken(phone1);

        CompleteRegistrationRequest reg1 = CompleteRegistrationRequest.builder()
                .gymName("First Gym")
                .gymType(com.gymapp.module.auth.entity.GymType.COMMERCIAL)
                .ownerName("Owner One")
                .address(CompleteRegistrationRequest.AddressDto.builder()
                        .line1("123 Test Street")
                        .state("Maharashtra")
                        .district("Mumbai")
                        .pincode("400001")
                        .build())
                .acceptedTerms(true)
                .termsVersion("1.0")
                .build();

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + regToken1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reg1)))
                .andExpect(status().isOk());

        // Replaying the exact same registrationToken a second time -> rejected with 401 INVALID_TOKEN
        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + regToken1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reg1)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("INVALID_TOKEN")));

        // 11b. Race condition: fresh registrationToken for a phone that was registered concurrently -> 409 Conflict
        String freshTokenForExistingPhone = jwtUtil.generateRegistrationToken(phone1);
        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + freshTokenForExistingPhone)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reg1)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", is("PHONE_ALREADY_EXISTS")));

        // 11c. Normal access token (ROLE_OWNER) cannot call complete-registration -> 403 Forbidden
        User owner1 = userRepository.findByPhone(phone1).orElseThrow();
        String ownerAccessToken = jwtUtil.generateAccessToken(owner1.getId(), owner1.getGymId(), "OWNER");
        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + ownerAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reg1)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("12. Idempotent startup migration drops legacy user fields, converts PENDING_APPROVAL/REJECTED to INACTIVE, and renames gymCode to receiptPrefix")
    void startupMigration_idempotentAndMigratesDocuments() {
        // Insert raw legacy documents directly via MongoTemplate
        Document legacyPendingUser = new Document()
                .append("name", "Legacy Pending Trainer")
                .append("phone", "9876500301")
                .append("role", "TRAINER")
                .append("active", false)
                .append("status", "PENDING_APPROVAL")
                .append("passwordHash", "$2a$10$legacyhash")
                .append("failedAttempts", 3)
                .append("lockedUntil", Instant.now())
                .append("mustChangePassword", true);
        mongoTemplate.getCollection("users").insertOne(legacyPendingUser);

        Document legacyRejectedUser = new Document()
                .append("name", "Legacy Rejected Trainer")
                .append("phone", "9876500302")
                .append("role", "TRAINER")
                .append("active", false)
                .append("status", "REJECTED")
                .append("passwordHash", "$2a$10$legacyhash2");
        mongoTemplate.getCollection("users").insertOne(legacyRejectedUser);

        Document legacyGym = new Document()
                .append("name", "Legacy Gym")
                .append("ownerName", "Legacy Owner")
                .append("phone", "9876500303")
                .append("receiptPrefix", "LEGACY9999")
                .append("status", "ACTIVE");
        mongoTemplate.getCollection("gyms").insertOne(legacyGym);

        Document gymWithoutCode = new Document()
                .append("name", "Gym Without Code")
                .append("ownerName", "Owner No Code")
                .append("phone", "9876500304")
                .append("status", "ACTIVE");
        mongoTemplate.getCollection("gyms").insertOne(gymWithoutCode);

        // Run migration first time
        DatabaseStartupMigration.MigrationResult firstRun = databaseStartupMigration.runMigration();
        assertThat(firstRun.usersLegacyFieldsDropped()).isEqualTo(2L);
        assertThat(firstRun.usersStatusConverted()).isEqualTo(2L);
        assertThat(firstRun.gymsRenamed()).isGreaterThanOrEqualTo(1L);
        assertThat(firstRun.gymCodesGenerated()).isGreaterThanOrEqualTo(1L);

        // Verify user fields were dropped and statuses converted to INACTIVE
        Document migratedUser1 = mongoTemplate.findOne(
                new Query(Criteria.where("phone").is("9876500301")), Document.class, "users");
        assertThat(migratedUser1).isNotNull();
        assertThat(migratedUser1.containsKey("passwordHash")).isFalse();
        assertThat(migratedUser1.containsKey("failedAttempts")).isFalse();
        assertThat(migratedUser1.containsKey("lockedUntil")).isFalse();
        assertThat(migratedUser1.containsKey("mustChangePassword")).isFalse();
        assertThat(migratedUser1.getString("status")).isEqualTo("INACTIVE");
        assertThat(migratedUser1.getBoolean("active")).isFalse();

        Document migratedUser2 = mongoTemplate.findOne(
                new Query(Criteria.where("phone").is("9876500302")), Document.class, "users");
        assertThat(migratedUser2).isNotNull();
        assertThat(migratedUser2.containsKey("passwordHash")).isFalse();
        assertThat(migratedUser2.getString("status")).isEqualTo("INACTIVE");

        // Verify receiptPrefix was renamed back to gymCode and gymType is null
        Document migratedGym = mongoTemplate.findOne(
                new Query(Criteria.where("phone").is("9876500303")), Document.class, "gyms");
        assertThat(migratedGym).isNotNull();
        assertThat(migratedGym.containsKey("receiptPrefix")).isFalse();
        assertThat(migratedGym.getString("gymCode")).isEqualTo("LEGACY9999");
        assertThat(migratedGym.get("gymType")).isNull();

        // Verify gym without code had a gymCode generated
        Document migratedGym2 = mongoTemplate.findOne(
                new Query(Criteria.where("phone").is("9876500304")), Document.class, "gyms");
        assertThat(migratedGym2).isNotNull();
        assertThat(migratedGym2.getString("gymCode")).isNotBlank();
        assertThat(migratedGym2.getString("gymCode")).matches("^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$");
        assertThat(migratedGym2.get("gymType")).isNull();

        // Run migration second time -> must be idempotent (0 documents changed)
        DatabaseStartupMigration.MigrationResult secondRun = databaseStartupMigration.runMigration();
        assertThat(secondRun.usersLegacyFieldsDropped()).isZero();
        assertThat(secondRun.usersStatusConverted()).isZero();
        assertThat(secondRun.gymsRenamed()).isZero();
        assertThat(secondRun.gymCodesGenerated()).isZero();
    }

    @Test
    @DisplayName("13. SUPER_ADMIN is seeded at startup when none exists and logs in through the OTP flow")
    void superAdmin_seededAndLogsInViaOtp() throws Exception {
        userRepository.deleteAll(userRepository.findByRole("SUPER_ADMIN"));

        String superAdminPhone = "9876500401";
        boolean seeded = databaseStartupMigration.seedSuperAdminIfNeeded("+91" + superAdminPhone);
        assertThat(seeded).isTrue();

        // Calling seedSuperAdminIfNeeded again is a no-op since one SUPER_ADMIN already exists
        boolean seededAgain = databaseStartupMigration.seedSuperAdminIfNeeded("9876500402");
        assertThat(seededAgain).isFalse();

        // SUPER_ADMIN logs in via standard OTP flow
        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + superAdminPhone + "\"}"))
                .andExpect(status().isOk());

        MvcResult verifyRes = mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + superAdminPhone + "\", \"otp\": \"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isNewUser", is(false)))
                .andExpect(jsonPath("$.data.user.role", is("SUPER_ADMIN")))
                .andExpect(jsonPath("$.data.user.gymId").doesNotExist())
                .andReturn();

        String superAdminToken = "Bearer " + objectMapper.readTree(verifyRes.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();

        // SUPER_ADMIN can call /api/admin/gyms
        mockMvc.perform(get("/api/admin/gyms")
                        .header("Authorization", superAdminToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("14. Security hardening: X-Forwarded-For spoofing is ignored from untrusted remoteAddr, but CF-Connecting-IP / X-Forwarded-For is trusted from Cloudflare tunnel (127.0.0.1)")
    void xForwardedForSpoofing_ignoredFromDirectPeer_trustedOnlyFromCloudflareTunnel() throws Exception {
        // 14a. Untrusted direct peer (198.51.100.77) spoofing different X-Forwarded-For and CF-Connecting-IP headers on every request
        String untrustedPeerIp = "198.51.100.77";
        for (int i = 0; i < 10; i++) {
            String phone = String.format("98765005%02d", i);
            String spoofedIp = "10.99.0." + (i + 1);
            mockMvc.perform(post("/api/auth/send-otp")
                            .with(req -> {
                                req.setRemoteAddr(untrustedPeerIp);
                                return req;
                            })
                            .header("X-Forwarded-For", spoofedIp)
                            .header("CF-Connecting-IP", spoofedIp)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"phone\": \"" + phone + "\"}"))
                    .andExpect(status().isOk());
        }

        // 11th request from same untrusted TCP peer with a brand-new spoofed IP -> still 429 RATE_LIMITED
        mockMvc.perform(post("/api/auth/send-otp")
                        .with(req -> {
                            req.setRemoteAddr(untrustedPeerIp);
                            return req;
                        })
                        .header("X-Forwarded-For", "10.99.0.250")
                        .header("CF-Connecting-IP", "10.99.0.250")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"9876500599\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error", is("RATE_LIMITED")));

        // 14b. Trusted Cloudflare tunnel peer (127.0.0.1): rate limits by CF-Connecting-IP per real client
        String cfClientA = "198.51.100.88";
        String cfClientB = "198.51.100.89";
        for (int i = 0; i < 10; i++) {
            String phone = String.format("98765006%02d", i);
            mockMvc.perform(post("/api/auth/send-otp")
                            .with(req -> {
                                req.setRemoteAddr("127.0.0.1");
                                return req;
                            })
                            .header("CF-Connecting-IP", cfClientA)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"phone\": \"" + phone + "\"}"))
                    .andExpect(status().isOk());
        }

        // 11th request from cfClientA through tunnel -> 429 RATE_LIMITED
        mockMvc.perform(post("/api/auth/send-otp")
                        .with(req -> {
                            req.setRemoteAddr("127.0.0.1");
                            return req;
                        })
                        .header("CF-Connecting-IP", cfClientA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"9876500698\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error", is("RATE_LIMITED")));

        // Meanwhile cfClientB through the same 127.0.0.1 tunnel succeeds (not blocked by cfClientA)
        mockMvc.perform(post("/api/auth/send-otp")
                        .with(req -> {
                            req.setRemoteAddr("127.0.0.1");
                            return req;
                        })
                        .header("CF-Connecting-IP", cfClientB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"9876500699\"}"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("15. Security hardening: phone number that is both a trainer and a new-owner candidate cannot complete owner registration after being added as trainer")
    void phoneBothTrainerAndNewOwnerCandidate_rejectedOnCompleteRegistration() throws Exception {
        // Setup an existing Gym + Owner
        String ownerPhone = "9876500701";
        JsonNode ownerData = registerGymViaOtpToken(
                mockMvc, objectMapper, "Dual Check Gym", "Dual Owner", ownerPhone, null);
        String ownerToken = "Bearer " + ownerData.path("accessToken").asText();
        String gymId = ownerData.path("user").path("gymId").asText();

        MvcResult typesRes = mockMvc.perform(get("/api/trainer-types")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andReturn();
        String typeId = objectMapper.readTree(typesRes.getResponse().getContentAsString())
                .path("data").get(0).path("id").asText();

        // Candidate phone verifies OTP first as a new user and receives a 15-min registrationToken
        String candidatePhone = "9876500702";
        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + candidatePhone + "\"}"))
                .andExpect(status().isOk());

        MvcResult verifyRes = mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + candidatePhone + "\", \"otp\": \"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isNewUser", is(true)))
                .andReturn();
        String candidateRegToken = objectMapper.readTree(verifyRes.getResponse().getContentAsString())
                .path("data").path("registrationToken").asText();

        // Before candidate completes gym registration, the Gym Owner creates a TRAINER with candidatePhone
        mockMvc.perform(post("/api/trainers")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Trainer Candidate\",\"phone\":\"" + candidatePhone + "\",\"trainerTypeIds\":[\"" + typeId + "\"]}"))
                .andExpect(status().isCreated());

        // Candidate now attempts to use their registrationToken on /api/auth/complete-registration -> rejected with 409
        CompleteRegistrationRequest candidateReq = CompleteRegistrationRequest.builder()
                .gymName("Candidate Own Gym")
                .gymType(com.gymapp.module.auth.entity.GymType.COMMERCIAL)
                .ownerName("Trainer Candidate")
                .address(CompleteRegistrationRequest.AddressDto.builder()
                        .line1("123 Test Street")
                        .state("Maharashtra")
                        .district("Mumbai")
                        .pincode("400001")
                        .build())
                .acceptedTerms(true)
                .termsVersion("1.0")
                .build();

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + candidateRegToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(candidateReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", is("PHONE_ALREADY_EXISTS")));

        // Subsequent replay of the same registrationToken is also rejected
        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + candidateRegToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(candidateReq)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("INVALID_TOKEN")));

        // When candidate logs in via OTP now, they sign in as TRAINER of Dual Check Gym
        OtpRequest otpReq = otpRequestRepository.findByPhone(candidatePhone).orElseThrow();
        otpReq.setLastSentAt(Instant.now().minusSeconds(31));
        otpRequestRepository.save(otpReq);

        mockMvc.perform(post("/api/auth/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + candidatePhone + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\": \"" + candidatePhone + "\", \"otp\": \"123456\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isNewUser", is(false)))
                .andExpect(jsonPath("$.data.user.role", is("TRAINER")))
                .andExpect(jsonPath("$.data.user.gymId", is(gymId)));
    }

    @Test
    @DisplayName("16. Security hardening: refresh token rotation updates refreshTokenHash, rejects replayed tokens, and PUT /api/auth/me phone change invalidates active tokens")
    void refreshTokenRotation_andUpdateMePhoneChangeInvalidatesTokens() throws Exception {
        String phone = "9876500801";
        JsonNode regData = registerGymViaOtpToken(
                mockMvc, objectMapper, "Rotation Gym", "Rotation Owner", phone, null);
        String accessToken1 = regData.path("accessToken").asText();
        String refreshToken1 = regData.path("refreshToken").asText();
        String userId = regData.path("user").path("id").asText();

        // Verify refreshTokenHash is stored on User (and never equals plain refreshToken)
        User userBefore = userRepository.findById(userId).orElseThrow();
        assertThat(userBefore.getRefreshTokenHash())
                .isNotBlank()
                .isNotEqualTo(refreshToken1)
                .isEqualTo(OtpService.sha256Hex(refreshToken1));

        // Rotate refresh token via POST /api/auth/refresh
        MvcResult refreshRes = mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refreshToken1 + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken", not(emptyOrNullString())))
                .andExpect(jsonPath("$.data.refreshToken", not(emptyOrNullString())))
                .andReturn();

        JsonNode refreshData = objectMapper.readTree(refreshRes.getResponse().getContentAsString()).path("data");
        String accessToken2 = refreshData.path("accessToken").asText();
        String refreshToken2 = refreshData.path("refreshToken").asText();
        assertThat(refreshToken2).isNotEqualTo(refreshToken1);

        // Replaying old refreshToken1 fails with 401 REFRESH_TOKEN_NOT_FOUND
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refreshToken1 + "\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("REFRESH_TOKEN_NOT_FOUND")));

        // Owner changes own phone via PUT /api/auth/me -> bumps tokenVersion and revokes refreshToken2
        String newOwnerPhone = "9876500802";
        mockMvc.perform(put("/api/auth/me")
                        .header("Authorization", "Bearer " + accessToken2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Rotation Owner\",\"phone\":\"" + newOwnerPhone + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.phone", is(newOwnerPhone)));

        // Old accessToken2 must now be rejected with 401 Unauthorized
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + accessToken2))
                .andExpect(status().isUnauthorized());

        // Old refreshToken2 must also be rejected with 401 REFRESH_TOKEN_NOT_FOUND
        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"" + refreshToken2 + "\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("REFRESH_TOKEN_NOT_FOUND")));
    }

    @Test
    @DisplayName("17. Security hardening: compound dev+prod or production profile with dev-fixed-code refuses to start, and TTL index retains rate-limit records for 1 hour")
    void compoundDevProdProfileRefusesToStart_andTtlIndexIsOneHour() {
        // Verify TTL index expireAfter is 3600s (1 hour) so 5-min OTP expiry does not wipe hourly rate limits
        List<IndexInfo> indexes = mongoTemplate.indexOps("otp_requests").getIndexInfo();
        IndexInfo ttlIndex = indexes.stream()
                .filter(idx -> "otp_expires_ttl_idx".equals(idx.getName()))
                .findFirst()
                .orElseThrow();
        assertThat(ttlIndex.getExpireAfter()).isPresent();
        assertThat(ttlIndex.getExpireAfter().get().getSeconds()).isGreaterThanOrEqualTo(3600L);

        // Compound profile "dev,prod" must still fail startup if app.otp.dev-fixed-code is set
        org.springframework.mock.env.MockEnvironment compoundEnv = new org.springframework.mock.env.MockEnvironment();
        compoundEnv.setActiveProfiles("dev", "prod");
        compoundEnv.setProperty("app.otp.pepper", "secret-pepper");
        compoundEnv.setProperty("app.otp.dev-fixed-code", "123456");

        new ApplicationContextRunner()
                .withBean(OtpService.class,
                        () -> new OtpService(otpRequestRepository, userRepository, gymRepository, refreshTokenRepository, jwtUtil,
                                compoundEnv, null))
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .rootCause()
                            .isInstanceOf(IllegalStateException.class)
                            .hasMessageContaining("app.otp.dev-fixed-code");
                });
    }
}
