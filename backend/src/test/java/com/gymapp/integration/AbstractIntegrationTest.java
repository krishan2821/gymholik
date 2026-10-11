package com.gymapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.module.auth.dto.CompleteRegistrationRequest;
import com.gymapp.module.auth.service.OtpService;
import com.gymapp.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.MongoDBContainer;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class AbstractIntegrationTest {

    public static final String MONGO_IMAGE = "mongo:7";

    static final MongoDBContainer mongoDBContainer = new MongoDBContainer(MONGO_IMAGE);

    static {
        mongoDBContainer.start();
    }

    @DynamicPropertySource
    static void setProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", mongoDBContainer::getReplicaSetUrl);
    }

    @Autowired(required = false)
    protected OtpService otpService;

    @Autowired(required = false)
    protected JwtUtil jwtUtil;

    @BeforeEach
    void resetRateLimiter() {
        if (otpService != null) {
            otpService.resetIpRateLimits();
        }
    }

    protected String bearerTokenForUser(String userId, String gymId, String role) {
        return "Bearer " + jwtUtil.generateAccessToken(userId, gymId, role);
    }

    protected JsonNode registerGymViaOtpToken(
            MockMvc mockMvc,
            ObjectMapper objectMapper,
            String gymName,
            String ownerName,
            String ownerPhone,
            String email) throws Exception {
        String regToken = jwtUtil.generateRegistrationToken(ownerPhone);
        CompleteRegistrationRequest req = CompleteRegistrationRequest.builder()
                .gymName(gymName)
                .gymType(com.gymapp.module.auth.entity.GymType.COMMERCIAL)
                .ownerName(ownerName)
                .email(email)
                .address(CompleteRegistrationRequest.AddressDto.builder()
                        .line1("123 Test Street")
                        .state("Maharashtra")
                        .district("Mumbai")
                        .pincode("400001")
                        .build())
                .acceptedTerms(true)
                .termsVersion("1.0")
                .build();

        MvcResult res = mockMvc.perform(post("/api/auth/complete-registration")
                        .header("Authorization", "Bearer " + regToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        return objectMapper.readTree(res.getResponse().getContentAsString()).path("data");
    }
}
