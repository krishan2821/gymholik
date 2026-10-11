package com.gymapp.integration;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.audit.entity.AuditLog;
import com.gymapp.module.audit.repository.AuditLogRepository;
import com.gymapp.module.auth.dto.CompleteRegistrationRequest;
import com.gymapp.module.auth.dto.CreateStaffRequest;
import com.gymapp.module.auth.dto.UpdateGymProfileRequest;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.entity.GymType;
import com.gymapp.module.auth.entity.LegalIdType;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.GymRepository;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.auth.service.AuthService;
import com.gymapp.module.auth.service.GymCodeGenerator;
import com.gymapp.module.trainer.dto.CreateTrainerRequest;
import com.gymapp.module.trainer.entity.TrainerType;
import com.gymapp.module.trainer.repository.TrainerTypeRepository;
import com.gymapp.security.JwtUtil;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

public class GymRegistrationAndProfileIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private GymRepository gymRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.gymapp.module.auth.repository.RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private TrainerTypeRepository trainerTypeRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private AuthService authService;

    private ListAppender<ILoggingEvent> logWatcher;
    private Logger rootLogger;

    @BeforeEach
    void setupLogWatcher() {
        rootLogger = (Logger) LoggerFactory.getLogger("com.gymapp");
        logWatcher = new ListAppender<>();
        logWatcher.start();
        rootLogger.addAppender(logWatcher);
    }

    @AfterEach
    void tearDownLogWatcher() {
        if (rootLogger != null && logWatcher != null) {
            rootLogger.detachAppender(logWatcher);
        }
    }

    private CompleteRegistrationRequest.AddressDto createValidAddress(String state) {
        return CompleteRegistrationRequest.AddressDto.builder()
                .line1("Flat 402, Sunshine Heights, Linking Road")
                .line2("Bandra West")
                .state(state != null ? state : "Maharashtra")
                .district("Mumbai Suburban")
                .pincode("400050")
                .build();
    }

    private CompleteRegistrationRequest createRegistrationRequest(
            String gymName,
            GymType gymType,
            LegalIdType legalIdType,
            String legalIdNumber,
            String state) {
        return CompleteRegistrationRequest.builder()
                .gymName(gymName)
                .gymType(gymType)
                .ownerName("Sameer Khan")
                .email("sameer@gym.in")
                .legalIdType(legalIdType)
                .legalIdNumber(legalIdNumber)
                .address(createValidAddress(state))
                .acceptedTerms(true)
                .termsVersion("2.0")
                .build();
    }

    // ── 1. Valid registration for each legal ID type and with none ────────────────
    @Test
    @DisplayName("1. Valid registration for UDYAM, GSTIN, NIC, and NONE; supports multiple branches with same legal ID")
    void validRegistration_eachLegalIdType_andNone() throws Exception {
        // A. UDYAM registration
        String phoneUdyam = "9876510001";
        String tokenUdyam = jwtUtil.generateRegistrationToken(phoneUdyam);
        CompleteRegistrationRequest reqUdyam = createRegistrationRequest(
                "Titan Power Gym", GymType.COMMERCIAL, LegalIdType.UDYAM, "UDYAM-MH-01-0012345", "Maharashtra");

        MvcResult resUdyam = mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + tokenUdyam)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqUdyam)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gym.gymCode", matchesPattern("^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$")))
                .andExpect(jsonPath("$.data.gym.gymType", is("COMMERCIAL")))
                .andReturn();

        JsonNode dataUdyam = objectMapper.readTree(resUdyam.getResponse().getContentAsString()).path("data");
        String gymIdUdyam = dataUdyam.path("gym").path("id").asText();
        Gym gymUdyam = gymRepository.findById(gymIdUdyam).orElseThrow();
        assertThat(gymUdyam.getLegalIdType()).isEqualTo(LegalIdType.UDYAM);
        assertThat(gymUdyam.getLegalIdNumber()).isEqualTo("UDYAM-MH-01-0012345");
        assertThat(gymUdyam.isLegalIdVerified()).isFalse();
        assertThat(gymUdyam.getGymCode()).hasSize(8);

        // B. GSTIN registration
        String phoneGstin = "9876510002";
        String tokenGstin = jwtUtil.generateRegistrationToken(phoneGstin);
        CompleteRegistrationRequest reqGstin = createRegistrationRequest(
                "CrossFit Alpha", GymType.CROSSFIT_BOX, LegalIdType.GSTIN, "27AAAAA0000A1Z5", "Delhi");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + tokenGstin)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqGstin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gym.gymType", is("CROSSFIT_BOX")))
                .andExpect(jsonPath("$.data.gym.gymCode", matchesPattern("^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$")));

        // C. NIC registration (length 4 and 5)
        String phoneNic = "9876510003";
        String tokenNic = jwtUtil.generateRegistrationToken(phoneNic);
        CompleteRegistrationRequest reqNic = createRegistrationRequest(
                "FitLife Studio", GymType.BOUTIQUE_STUDIO, LegalIdType.NIC, "9311", "Karnataka");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + tokenNic)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqNic)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gym.gymType", is("BOUTIQUE_STUDIO")));

        // D. Registration with NO legal ID (nullable)
        String phoneNone = "9876510004";
        String tokenNone = jwtUtil.generateRegistrationToken(phoneNone);
        CompleteRegistrationRequest reqNone = createRegistrationRequest(
                "Pure Strength", GymType.BODYBUILDING_POWERLIFTING, null, null, "Goa");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + tokenNone)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqNone)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gym.gymType", is("BODYBUILDING_POWERLIFTING")));

        // E. Multiple branches can use the same legal ID (non-unique plain index)
        String phoneBranch2 = "9876510005";
        String tokenBranch2 = jwtUtil.generateRegistrationToken(phoneBranch2);
        CompleteRegistrationRequest reqBranch2 = createRegistrationRequest(
                "Titan Power Gym Branch 2", GymType.COMMERCIAL, LegalIdType.UDYAM, "UDYAM-MH-01-0012345", "Maharashtra");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + tokenBranch2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reqBranch2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gym.name", is("Titan Power Gym Branch 2")));
    }

    // ── 2. Invalid formats rejected with field errors ─────────────────────────────
    @Test
    @DisplayName("2. Each invalid format is rejected with field errors under error.fields")
    void invalidFormats_rejectedWithFieldErrors() throws Exception {
        String phone = "9876510010";
        String token = jwtUtil.generateRegistrationToken(phone);

        // A. Invalid UDYAM format
        CompleteRegistrationRequest badUdyam = createRegistrationRequest(
                "Iron Gym", GymType.COMMERCIAL, LegalIdType.UDYAM, "UDYAM-INVALID", "Delhi");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badUdyam)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.legalIdNumber", notNullValue()));

        // B. Invalid GSTIN format
        CompleteRegistrationRequest badGstin = createRegistrationRequest(
                "Iron Gym", GymType.COMMERCIAL, LegalIdType.GSTIN, "INVALID_GSTIN_123", "Delhi");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badGstin)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.legalIdNumber", notNullValue()));

        // C. Invalid NIC format (less than 4 digits)
        CompleteRegistrationRequest badNicShort = createRegistrationRequest(
                "Iron Gym", GymType.COMMERCIAL, LegalIdType.NIC, "123", "Delhi");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badNicShort)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.legalIdNumber", notNullValue()));

        // D. Invalid NIC format (more than 5 digits)
        CompleteRegistrationRequest badNicLong = createRegistrationRequest(
                "Iron Gym", GymType.COMMERCIAL, LegalIdType.NIC, "123456", "Delhi");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badNicLong)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.legalIdNumber", notNullValue()));

        // E. Invalid NIC format (letters)
        CompleteRegistrationRequest badNicLetters = createRegistrationRequest(
                "Iron Gym", GymType.COMMERCIAL, LegalIdType.NIC, "ABCD", "Delhi");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badNicLetters)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.legalIdNumber", notNullValue()));

        // F. Short gym name (< 2 chars)
        CompleteRegistrationRequest badGymName = createRegistrationRequest(
                "A", GymType.COMMERCIAL, null, null, "Delhi");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badGymName)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.gymName", notNullValue()));

        // G. Short line1 (< 5 chars)
        CompleteRegistrationRequest badLine1 = createRegistrationRequest(
                "Valid Gym", GymType.COMMERCIAL, null, null, "Delhi");
        badLine1.getAddress().setLine1("123");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badLine1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields['address.line1']", notNullValue()));
    }

    // ── 3. Invalid state or pincode rejected ──────────────────────────────────────
    @Test
    @DisplayName("3. Invalid state and invalid pincode are rejected with field errors")
    void invalidStateOrPincode_rejected() throws Exception {
        String phone = "9876510020";
        String token = jwtUtil.generateRegistrationToken(phone);

        // A. Invalid state (not among 36 Indian states and UTs)
        CompleteRegistrationRequest badState = createRegistrationRequest(
                "Metro Gym", GymType.COMMERCIAL, null, null, "California");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badState)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields['address.state']", notNullValue()));

        // B. Invalid pincode (starts with 0)
        CompleteRegistrationRequest badPin0 = createRegistrationRequest(
                "Metro Gym", GymType.COMMERCIAL, null, null, "Delhi");
        badPin0.getAddress().setPincode("012345");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badPin0)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields['address.pincode']", notNullValue()));

        // C. Invalid pincode (5 digits)
        CompleteRegistrationRequest badPin5 = createRegistrationRequest(
                "Metro Gym", GymType.COMMERCIAL, null, null, "Delhi");
        badPin5.getAddress().setPincode("12345");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badPin5)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields['address.pincode']", notNullValue()));

        // D. Valid UTs pass (e.g. Puducherry and Dadra and Nagar Haveli and Daman and Diu)
        String phoneUt = "9876510021";
        String tokenUt = jwtUtil.generateRegistrationToken(phoneUt);
        CompleteRegistrationRequest validUt = createRegistrationRequest(
                "Puducherry Fitness", GymType.PREMIUM_LUXURY, null, null, "Puducherry");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + tokenUt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validUt)))
                .andExpect(status().isOk());
    }

    // ── 4. Mismatch of legalIdType and legalIdNumber rejected ─────────────────────
    @Test
    @DisplayName("4. Mismatch of legalIdType and legalIdNumber rejected with field errors")
    void mismatchLegalIdTypeAndNumber_rejected() throws Exception {
        String phone = "9876510030";
        String token = jwtUtil.generateRegistrationToken(phone);

        // A. Type sent without number
        CompleteRegistrationRequest typeWithoutNumber = createRegistrationRequest(
                "Fit City", GymType.COMMERCIAL, LegalIdType.GSTIN, null, "Punjab");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(typeWithoutNumber)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.legalIdNumber", notNullValue()));

        // B. Number sent without type
        CompleteRegistrationRequest numberWithoutType = createRegistrationRequest(
                "Fit City", GymType.COMMERCIAL, null, "27AAAAA0000A1Z5", "Punjab");

        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(numberWithoutType)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.legalIdType", notNullValue()));
    }

    // ── 5. Gym code present, unique, 8 chars from the alphabet ─────────────────────
    @Test
    @DisplayName("5. Gym code generated is 8 chars from alphabet 23456789ABCDEFGHJKMNPQRSTUVWXYZ and unique")
    void gymCode_presentUnique8CharsFromAlphabet() throws Exception {
        String alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

        String p1 = "9876510041";
        String t1 = jwtUtil.generateRegistrationToken(p1);
        MvcResult res1 = mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + t1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRegistrationRequest("Gym 1", GymType.COMMERCIAL, null, null, "Haryana"))))
                .andExpect(status().isOk())
                .andReturn();

        String p2 = "9876510042";
        String t2 = jwtUtil.generateRegistrationToken(p2);
        MvcResult res2 = mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + t2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRegistrationRequest("Gym 2", GymType.COMMERCIAL, null, null, "Haryana"))))
                .andExpect(status().isOk())
                .andReturn();

        String code1 = objectMapper.readTree(res1.getResponse().getContentAsString()).path("data").path("gym").path("gymCode").asText();
        String code2 = objectMapper.readTree(res2.getResponse().getContentAsString()).path("data").path("gym").path("gymCode").asText();

        assertThat(code1).hasSize(8);
        assertThat(code2).hasSize(8);
        assertThat(code1).isNotEqualTo(code2);

        for (char c : code1.toCharArray()) {
            assertThat(alphabet).contains(String.valueOf(c));
        }
        for (char c : code2.toCharArray()) {
            assertThat(alphabet).contains(String.valueOf(c));
        }
    }

    // ── 6. Collision retry using a fake generator ─────────────────────────────────
    @Test
    @DisplayName("6. Collision retry up to 5 times on duplicate gym code")
    void collisionRetry_usesFakeGenerator() {
        GymCodeGenerator fakeGenerator = mock(GymCodeGenerator.class);
        // Returns "COLLIDE1" twice (which already exists), then "SUCCESS1"
        when(fakeGenerator.generate()).thenReturn("COLLIDE1", "COLLIDE1", "SUCCESS1");

        // Seed existing gym with "COLLIDE1"
        Gym existing = Gym.builder()
                .name("Existing Colliding Gym")
                .gymCode("COLLIDE1")
                .status("ACTIVE")
                .build();
        gymRepository.save(existing);

        AuthService serviceWithFakeGenerator = new AuthService(
                gymRepository, userRepository, refreshTokenRepository, jwtUtil, null, null, null, null, fakeGenerator);

        CompleteRegistrationRequest req = createRegistrationRequest("Retry Gym", GymType.HOME_GYM, null, null, "Kerala");
        String phone = "9876510051";
        String regToken = jwtUtil.generateRegistrationToken(phone);

        var response = serviceWithFakeGenerator.completeRegistration(phone, regToken, req);
        assertThat(response.getGym().getGymCode()).isEqualTo("SUCCESS1");

        // Verify generator was invoked 3 times (2 collisions + 1 success)
        verify(fakeGenerator, times(3)).generate();

        // If it collides 5 times, it throws INTERNAL_ERROR
        GymCodeGenerator alwaysCollidingGenerator = mock(GymCodeGenerator.class);
        when(alwaysCollidingGenerator.generate()).thenReturn("COLLIDE1");

        AuthService serviceAlwaysColliding = new AuthService(
                gymRepository, userRepository, refreshTokenRepository, jwtUtil, null, null, null, null, alwaysCollidingGenerator);

        String phone2 = "9876510052";
        String regToken2 = jwtUtil.generateRegistrationToken(phone2);
        assertThatThrownBy(() -> serviceAlwaysColliding.completeRegistration(phone2, regToken2, req))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode()).isEqualTo(ErrorCode.INTERNAL_ERROR));
    }

    // ── 7. Token single-use and 30 minute lifetime ────────────────────────────────
    @Test
    @DisplayName("7. Registration token has 30-minute validity and cannot be reused")
    void tokenSingleUse_and30MinuteLifetime() throws Exception {
        String phone = "9876510061";
        String regToken = jwtUtil.generateRegistrationToken(phone);

        Claims claims = jwtUtil.validateAndExtractClaims(regToken);
        Date issuedAt = claims.getIssuedAt();
        Date expiration = claims.getExpiration();
        long diffMs = expiration.getTime() - issuedAt.getTime();
        assertThat(diffMs).isEqualTo(1_800_000L); // Exactly 30 minutes

        CompleteRegistrationRequest req = createRegistrationRequest(
                "Alpha Club", GymType.COMMERCIAL, null, null, "Rajasthan");

        // First use: succeeds
        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + regToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        // Reusing the same token fails with 401 INVALID_TOKEN
        mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + regToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error", is("INVALID_TOKEN")));
    }

    // ── 8. OWNER sees gymCode in /me, STAFF and TRAINER do not ────────────────────
    @Test
    @DisplayName("8. OWNER sees gymCode in /me, STAFF and TRAINER do not (neither gets legal ID)")
    void meEndpoint_roleBasedGymCodeVisibility() throws Exception {
        String ownerPhone = "9876510071";
        String ownerRegToken = jwtUtil.generateRegistrationToken(ownerPhone);
        CompleteRegistrationRequest req = createRegistrationRequest(
                "Iron Kingdom", GymType.COMMERCIAL, LegalIdType.GSTIN, "27AAAAA0000A1Z5", "Maharashtra");

        MvcResult regRes = mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + ownerRegToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode data = objectMapper.readTree(regRes.getResponse().getContentAsString()).path("data");
        String ownerAccessToken = data.path("accessToken").asText();
        String gymId = data.path("gym").path("id").asText();
        String expectedGymCode = data.path("gym").path("gymCode").asText();

        // 1. OWNER calls /api/auth/me -> sees gymCode
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + ownerAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gymCode", is(expectedGymCode)))
                .andExpect(jsonPath("$.data.gym.gymCode", is(expectedGymCode)))
                .andExpect(jsonPath("$.data.gym.gymType", is("COMMERCIAL")))
                .andExpect(jsonPath("$.data.legalIdNumber").doesNotExist())
                .andExpect(jsonPath("$.data.legalIdType").doesNotExist());

        // 2. OWNER creates a STAFF user
        String staffPhone = "9876510072";
        mockMvc.perform(post("/api/staff")
                        .header("Authorization", "Bearer " + ownerAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateStaffRequest("Staff Member", staffPhone))))
                .andExpect(status().isCreated());

        User staffUser = userRepository.findByPhone(staffPhone).orElseThrow();
        String staffAccessToken = jwtUtil.generateAccessToken(staffUser.getId(), gymId, "STAFF");

        // STAFF calls /api/auth/me -> gymCode is null, legal id does not exist
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + staffAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gymCode").doesNotExist())
                .andExpect(jsonPath("$.data.gym.gymCode").doesNotExist())
                .andExpect(jsonPath("$.data.gym.name", is("Iron Kingdom")))
                .andExpect(jsonPath("$.data.gym.gymType", is("COMMERCIAL")))
                .andExpect(jsonPath("$.data.legalIdNumber").doesNotExist())
                .andExpect(jsonPath("$.data.legalIdType").doesNotExist());

        // 3. OWNER creates a TRAINER user
        TrainerType trainerType = trainerTypeRepository.findByGymId(gymId).get(0);
        String trainerPhone = "9876510073";
        mockMvc.perform(post("/api/trainers")
                        .header("Authorization", "Bearer " + ownerAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CreateTrainerRequest("Trainer Jane", trainerPhone, List.of(trainerType.getId()), null))))
                .andExpect(status().isCreated());

        User trainerUser = userRepository.findByPhone(trainerPhone).orElseThrow();
        String trainerAccessToken = jwtUtil.generateAccessToken(trainerUser.getId(), gymId, "TRAINER");

        // TRAINER calls /api/auth/me -> gymCode is null, legal id does not exist
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + trainerAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gymCode").doesNotExist())
                .andExpect(jsonPath("$.data.gym.gymCode").doesNotExist())
                .andExpect(jsonPath("$.data.gym.name", is("Iron Kingdom")))
                .andExpect(jsonPath("$.data.gym.gymType", is("COMMERCIAL")))
                .andExpect(jsonPath("$.data.legalIdNumber").doesNotExist())
                .andExpect(jsonPath("$.data.legalIdType").doesNotExist());
    }

    // ── 9. Legal ID masked in profile, revealed on request with audit, never logged
    @Test
    @DisplayName("9. Legal ID masked to last 4 chars in profile; reveal=true audits action; never present in logs")
    void gymProfile_legalIdMasked_revealAudited_noLegalIdInLogs() throws Exception {
        String secretLegalId = "27AAAAA0000A1Z5";
        String phone = "9876510081";
        String token = jwtUtil.generateRegistrationToken(phone);
        CompleteRegistrationRequest req = createRegistrationRequest(
                "Security Elite", GymType.PREMIUM_LUXURY, LegalIdType.GSTIN, secretLegalId, "Maharashtra");

        MvcResult regRes = mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        String ownerAccessToken = objectMapper.readTree(regRes.getResponse().getContentAsString())
                .path("data").path("accessToken").asText();

        // 1. GET /api/gym/profile -> masked
        mockMvc.perform(get("/api/gym/profile")
                        .header("Authorization", "Bearer " + ownerAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.legalIdNumber", is("***********A1Z5")));

        // 2. GET /api/gym/profile?reveal=true -> unmasked + audit entry written
        mockMvc.perform(get("/api/gym/profile?reveal=true")
                        .header("Authorization", "Bearer " + ownerAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.legalIdNumber", is(secretLegalId)));

        List<AuditLog> auditLogs = auditLogRepository.findAll().stream()
                .filter(a -> "LEGAL_ID_VIEWED".equals(a.getAction()))
                .toList();
        assertThat(auditLogs).isNotEmpty();
        for (AuditLog audit : auditLogs) {
            assertThat(audit.getDetails()).doesNotContain(secretLegalId);
        }

        // 3. PUT /api/gym/profile -> updates profile without changing gymCode or legalIdVerified
        UpdateGymProfileRequest updateReq = UpdateGymProfileRequest.builder()
                .name("Security Elite Updated")
                .gymType(GymType.COMMERCIAL)
                .legalIdType(LegalIdType.GSTIN)
                .legalIdNumber("27BBBBB0000B1Z6")
                .address(createValidAddress("Maharashtra"))
                .build();

        mockMvc.perform(put("/api/gym/profile")
                        .header("Authorization", "Bearer " + ownerAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name", is("Security Elite Updated")))
                .andExpect(jsonPath("$.data.legalIdNumber", is("***********B1Z6")));

        // 4. Verify ZERO occurrences of secretLegalId in all application logs
        for (ILoggingEvent event : logWatcher.list) {
            assertThat(event.getFormattedMessage()).doesNotContain(secretLegalId);
            assertThat(event.getFormattedMessage()).doesNotContain("27BBBBB0000B1Z6");
        }
    }

    // ── 10. STAFF and TRAINER get 403 on /api/gym/profile ─────────────────────────
    @Test
    @DisplayName("10. STAFF and TRAINER get 403 Forbidden on GET and PUT /api/gym/profile")
    void gymProfile_staffAndTrainerGet403() throws Exception {
        String ownerPhone = "9876510091";
        String token = jwtUtil.generateRegistrationToken(ownerPhone);
        MvcResult regRes = mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRegistrationRequest("Guarded Gym", GymType.COMMERCIAL, null, null, "Delhi"))))
                .andExpect(status().isOk())
                .andReturn();

        String gymId = objectMapper.readTree(regRes.getResponse().getContentAsString()).path("data").path("gym").path("id").asText();

        User staff = userRepository.save(User.builder()
                .name("Guarded Staff")
                .phone("9876510092")
                .role("STAFF")
                .gymId(gymId)
                .status("ACTIVE")
                .active(true)
                .build());
        String staffToken = "Bearer " + jwtUtil.generateAccessToken(staff.getId(), gymId, "STAFF");

        User trainer = userRepository.save(User.builder()
                .name("Guarded Trainer")
                .phone("9876510093")
                .role("TRAINER")
                .gymId(gymId)
                .status("ACTIVE")
                .active(true)
                .build());
        String trainerToken = "Bearer " + jwtUtil.generateAccessToken(trainer.getId(), gymId, "TRAINER");

        UpdateGymProfileRequest validUpdate = UpdateGymProfileRequest.builder()
                .name("Valid Name")
                .gymType(GymType.COMMERCIAL)
                .address(createValidAddress("Maharashtra"))
                .build();
        String validUpdateJson = objectMapper.writeValueAsString(validUpdate);

        // STAFF GET & PUT -> 403
        mockMvc.perform(get("/api/gym/profile").header("Authorization", staffToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/gym/profile").header("Authorization", staffToken)
                        .contentType(MediaType.APPLICATION_JSON).content(validUpdateJson))
                .andExpect(status().isForbidden());

        // TRAINER GET & PUT -> 403
        mockMvc.perform(get("/api/gym/profile").header("Authorization", trainerToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/gym/profile").header("Authorization", trainerToken)
                        .contentType(MediaType.APPLICATION_JSON).content(validUpdateJson))
                .andExpect(status().isForbidden());
    }

    // ── 11. Gym A owner cannot read Gym B profile ─────────────────────────────────
    @Test
    @DisplayName("11. Gym A owner cannot read Gym B profile (tenant isolation)")
    void gymAOwner_cannotReadGymBProfile() throws Exception {
        // Register Gym A
        String phoneA = "9876510101";
        String tokenA = jwtUtil.generateRegistrationToken(phoneA);
        MvcResult regA = mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRegistrationRequest("Gym A", GymType.COMMERCIAL, null, null, "Delhi"))))
                .andExpect(status().isOk())
                .andReturn();

        String ownerAToken = "Bearer " + objectMapper.readTree(regA.getResponse().getContentAsString()).path("data").path("accessToken").asText();

        // Register Gym B
        String phoneB = "9876510102";
        String tokenB = jwtUtil.generateRegistrationToken(phoneB);
        MvcResult regB = mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + tokenB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createRegistrationRequest("Gym B", GymType.COMMERCIAL, null, null, "Delhi"))))
                .andExpect(status().isOk())
                .andReturn();

        // Owner A requests profile -> always gets Gym A, cannot access Gym B
        mockMvc.perform(get("/api/gym/profile").header("Authorization", ownerAToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name", is("Gym A")));
    }
}
