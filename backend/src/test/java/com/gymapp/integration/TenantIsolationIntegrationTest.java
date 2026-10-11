package com.gymapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.module.attendance.dto.CheckInRequest;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.GymRepository;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.member.dto.CreateMemberRequest;
import com.gymapp.module.member.dto.MemberResponse;
import com.gymapp.module.payment.dto.CreatePaymentRequest;
import com.gymapp.module.plan.dto.PlanRequest;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;

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

    @Autowired
    private UserRepository userRepository;

    private String gymA_Id;
    private String gymB_Id;
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
        // 1. Register Gym A + Owner A via OTP complete-registration
        JsonNode dataA = registerGymViaOtpToken(
                mockMvc, objectMapper, "Gym A", "Owner A", "9811111111", "ownera@gyma.com");
        gymA_Id = dataA.path("user").path("gymId").asText();
        gymA_OwnerToken = "Bearer " + dataA.path("accessToken").asText();

        // 2. Register Gym B + Owner B via OTP complete-registration
        JsonNode dataB = registerGymViaOtpToken(
                mockMvc, objectMapper, "Gym B", "Owner B", "9822222222", "ownerb@gymb.com");
        gymB_Id = dataB.path("user").path("gymId").asText();
        gymB_OwnerToken = "Bearer " + dataB.path("accessToken").asText();

        // 3. Seed Data A
        gymA_PlanId = createPlan(gymA_OwnerToken, "Plan A");
        MemberResponse mA = createMember(gymA_OwnerToken, "Member A", "9810000000", gymA_PlanId);
        gymA_MemberId = mA.getId();
        gymA_MembershipId = mA.getCurrentMembership().getId();
        gymA_PaymentId = createPayment(gymA_OwnerToken, gymA_MemberId, gymA_MembershipId);
        checkIn(gymA_OwnerToken, gymA_MemberId);

        // 4. Seed Data B
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
                .content("{\"name\":\"Staff A\", \"phone\":\"9811111112\"}"))
                .andExpect(status().isCreated());

        // 2. Issue token for Staff A via JwtUtil test helper
        User staffUser = userRepository.findByPhone("9811111112").orElseThrow();
        String staffToken = bearerTokenForUser(staffUser.getId(), gymA_Id, "STAFF");

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
                .content("{\"name\":\"Staff B\", \"phone\":\"9811111113\"}"))
                .andExpect(status().isForbidden()); // 403
    }

    @Test
    void testSubscriptionExpiredReturns402() throws Exception {
        // Expire Gym A manually in DB
        Gym gymA = gymRepository.findById(gymA_Id).orElseThrow();
        gymA.setSubscriptionValidTill(LocalDate.now().minusDays(10)); // past grace period (5 days)
        gymRepository.save(gymA);

        try {
            // A tries to list members -> 402 Payment Required
            mockMvc.perform(get("/api/members")
                    .header("Authorization", gymA_OwnerToken))
                    .andExpect(status().isPaymentRequired())
                    .andExpect(jsonPath("$.errorCode", is("SUBSCRIPTION_EXPIRED")));
        } finally {
            gymA.setSubscriptionValidTill(LocalDate.now().plusDays(10));
            gymRepository.save(gymA);
        }
    }
}
