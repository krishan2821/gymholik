package com.gymapp.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.common.ApiResponse;
import com.gymapp.module.attendance.dto.CheckInRequest;
import com.gymapp.module.auth.dto.LoginRequest;
import com.gymapp.module.auth.dto.RegisterGymRequest;
import com.gymapp.module.auth.dto.TokenResponse;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.repository.GymRepository;
import com.gymapp.module.member.dto.CreateMemberRequest;
import com.gymapp.module.member.dto.MemberResponse;
import com.gymapp.module.payment.dto.CreatePaymentRequest;

import com.gymapp.module.plan.dto.PlanRequest;
import com.gymapp.module.plan.dto.PlanResponse;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TenantIsolationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private GymRepository gymRepository;

    private String gymA_Code;
    private String gymB_Code;
    private String gymA_OwnerToken;
    private String gymB_OwnerToken;
    
    private String gymA_PlanId;
    private String gymB_PlanId;
    private String gymA_MemberId;
    private String gymB_MemberId;
    private String gymA_MembershipId;
    private String gymB_MembershipId;
    private String gymA_PaymentId;
    private String gymB_PaymentId;

    @BeforeAll
    void setup() throws Exception {
        if (loginRateLimiter != null) {
            loginRateLimiter.reset();
        }
        // 1. Register Gym A
        RegisterGymRequest reqA = new RegisterGymRequest();
        reqA.setGymName("Gym A");
        reqA.setOwnerName("Owner A");
        reqA.setOwnerPhone("9811111111");
        reqA.setPassword("password123");
        
        MvcResult resA = mockMvc.perform(post("/api/auth/register-gym")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reqA)))
                .andExpect(status().isCreated()).andReturn();
        gymA_Code = objectMapper.readTree(resA.getResponse().getContentAsString()).path("data").path("gymCode").asText();

        // 2. Register Gym B
        RegisterGymRequest reqB = new RegisterGymRequest();
        reqB.setGymName("Gym B");
        reqB.setOwnerName("Owner B");
        reqB.setOwnerPhone("9822222222");
        reqB.setPassword("password123");

        MvcResult resB = mockMvc.perform(post("/api/auth/register-gym")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reqB)))
                .andExpect(status().isCreated()).andReturn();
        gymB_Code = objectMapper.readTree(resB.getResponse().getContentAsString()).path("data").path("gymCode").asText();

        // 3. Login A
        LoginRequest loginA = new LoginRequest();
        loginA.setGymCode(gymA_Code);
        loginA.setPhone("9811111111");
        loginA.setPassword("password123");
        MvcResult loginResA = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginA)))
                .andExpect(status().isOk()).andReturn();
        gymA_OwnerToken = "Bearer " + objectMapper.readTree(loginResA.getResponse().getContentAsString()).path("data").path("accessToken").asText();

        // 4. Login B
        LoginRequest loginB = new LoginRequest();
        loginB.setGymCode(gymB_Code);
        loginB.setPhone("9822222222");
        loginB.setPassword("password123");
        MvcResult loginResB = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginB)))
                .andExpect(status().isOk()).andReturn();
        gymB_OwnerToken = "Bearer " + objectMapper.readTree(loginResB.getResponse().getContentAsString()).path("data").path("accessToken").asText();

        // 5. Seed Data A
        gymA_PlanId = createPlan(gymA_OwnerToken, "Plan A");
        MemberResponse mA = createMember(gymA_OwnerToken, "Member A", "9810000000", gymA_PlanId);
        gymA_MemberId = mA.getId();
        gymA_MembershipId = mA.getCurrentMembership().getId();
        gymA_PaymentId = createPayment(gymA_OwnerToken, gymA_MemberId, gymA_MembershipId);
        checkIn(gymA_OwnerToken, gymA_MemberId);

        // 6. Seed Data B
        gymB_PlanId = createPlan(gymB_OwnerToken, "Plan B");
        MemberResponse mB = createMember(gymB_OwnerToken, "Member B", "9820000000", gymB_PlanId);
        gymB_MemberId = mB.getId();
        gymB_MembershipId = mB.getCurrentMembership().getId();
        gymB_PaymentId = createPayment(gymB_OwnerToken, gymB_MemberId, gymB_MembershipId);
        checkIn(gymB_OwnerToken, gymB_MemberId);
    }

    private String createPlan(String token, String name) throws Exception {
        PlanRequest req = new PlanRequest();
        req.setName(name);
        req.setDurationDays(30);
        req.setPricePaise(100000L);
        MvcResult res = mockMvc.perform(post("/api/plans")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).path("data").path("id").asText();
    }

    private MemberResponse createMember(String token, String name, String phone, String planId) throws Exception {
        CreateMemberRequest req = new CreateMemberRequest();
        req.setName(name);
        req.setPhone(phone);
        req.setPlanId(planId);
        MvcResult res = mockMvc.perform(post("/api/members")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readValue(objectMapper.readTree(res.getResponse().getContentAsString()).path("data").toString(), MemberResponse.class);
    }

    private String createPayment(String token, String memberId, String membershipId) throws Exception {
        CreatePaymentRequest req = new CreatePaymentRequest();
        req.setMemberId(memberId);
        req.setMembershipId(membershipId);
        req.setAmountPaise(10000L);
        req.setMode("CASH");
        MvcResult res = mockMvc.perform(post("/api/payments")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).path("data").path("id").asText();
    }

    private void checkIn(String token, String memberId) throws Exception {
        CheckInRequest req = new CheckInRequest();
        req.setMemberId(memberId);
        mockMvc.perform(post("/api/attendance/checkin")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }

    @Test
    void testTenantIsolation_ReadCrossTenant_Returns404() throws Exception {
        // A tries to read B's member
        mockMvc.perform(get("/api/members/" + gymB_MemberId)
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isNotFound());

        // A tries to read B's plan
        mockMvc.perform(get("/api/plans/" + gymB_PlanId)
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isNotFound());

        // A tries to get B's receipt
        mockMvc.perform(get("/api/payments/" + gymB_PaymentId + "/receipt")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isNotFound());
                
        // A tries to delete B's member
        mockMvc.perform(delete("/api/members/" + gymB_MemberId)
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void testTenantIsolation_UpdateCrossTenant_Returns404() throws Exception {
        // A tries to update B's plan
        PlanRequest req = new PlanRequest();
        req.setName("Hacked Plan");
        req.setDurationDays(30);
        req.setPricePaise(1000L);

        mockMvc.perform(put("/api/plans/" + gymB_PlanId)
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isNotFound());
    }

    @Test
    void testTenantIsolation_ListsExcludeOtherTenant() throws Exception {
        // A lists members -> should only see Member A
        mockMvc.perform(get("/api/members")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].id", is(gymA_MemberId)));

        // A views dashboard -> should not sum B's collection
        mockMvc.perform(get("/api/dashboard")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.todayCollection", is(10000))) // Only A's payment
                .andExpect(jsonPath("$.data.activeMembers", is(1)));

        // A views attendance
        mockMvc.perform(get("/api/attendance")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].memberId", is(gymA_MemberId)));
                
        // A searches members by name
        mockMvc.perform(get("/api/members?search=Member")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].id", is(gymA_MemberId)));
                
        // A views dues
        mockMvc.perform(get("/api/payments/dues")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                // Assuming createPayment of 10000 on 100000 plan leaves 90000 due
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].memberId", is(gymA_MemberId)));
                
        // A views absent members
        mockMvc.perform(get("/api/attendance/absent?days=5")
                .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                // Should not see gymB_MemberId (might be 0 if A checked in today)
                .andExpect(jsonPath("$.data.content").isArray());
    }

    @Test
    void testStaffCannotCallOwnerEndpoints() throws Exception {
        // 1. Create Staff for Gym A
        mockMvc.perform(post("/api/staff")
                .header("Authorization", gymA_OwnerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Staff A\", \"phone\":\"9811111112\", \"password\":\"password123\"}"))
                .andExpect(status().isCreated());

        // 2. Login Staff A
        LoginRequest loginStaff = new LoginRequest();
        loginStaff.setGymCode(gymA_Code);
        loginStaff.setPhone("9811111112");
        loginStaff.setPassword("password123");
        MvcResult res = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginStaff)))
                .andExpect(status().isOk()).andReturn();
        String staffToken = "Bearer " + objectMapper.readTree(res.getResponse().getContentAsString()).path("data").path("accessToken").asText();

        // 3. Staff tries to create plan (OWNER only)
        PlanRequest req = new PlanRequest();
        req.setName("Staff Plan");
        req.setDurationDays(30);
        req.setPricePaise(10000L);

        mockMvc.perform(post("/api/plans")
                .header("Authorization", staffToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isForbidden()); // 403

        // 4. Staff tries to create staff
        mockMvc.perform(post("/api/staff")
                .header("Authorization", staffToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Staff B\", \"phone\":\"9811111113\", \"password\":\"password123\"}"))
                .andExpect(status().isForbidden()); // 403
    }

    @Test
    void testSubscriptionExpiredReturns402() throws Exception {
        // Expire Gym A manually in DB
        Gym gymA = gymRepository.findByGymCode(gymA_Code).orElseThrow();
        gymA.setSubscriptionValidTill(LocalDate.now().minusDays(10)); // past grace period (5 days)
        gymRepository.save(gymA);

        try {
            // A tries to list members -> 402 Payment Required
            mockMvc.perform(get("/api/members")
                    .header("Authorization", gymA_OwnerToken))
                    .andExpect(status().isPaymentRequired())
                    .andExpect(jsonPath("$.errorCode", is("SUBSCRIPTION_EXPIRED")));
        } finally {
            // Restore Gym A to not break other tests, although order isn't guaranteed
            // we should be careful. Actually tests might run in any order.
            // Let's restore immediately.
            gymA.setSubscriptionValidTill(LocalDate.now().plusDays(10));
            gymRepository.save(gymA);
        }
    }
}
