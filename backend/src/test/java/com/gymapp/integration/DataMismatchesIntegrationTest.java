package com.gymapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.module.member.dto.CreateMemberRequest;
import com.gymapp.module.plan.dto.PlanRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class DataMismatchesIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("Symptom 1 & 2: Dashboard totalDue and newJoinings count members accurately in Asia/Kolkata timezone")
    void testDashboardTotalDueAndNewJoinings() throws Exception {
        // Register gym "One fit"
        JsonNode data = registerGymViaOtpToken(
                mockMvc, objectMapper, "One fit", "Owner One", "9812345678", "owner@onefit.com");
        String ownerToken = "Bearer " + data.path("accessToken").asText();

        // Create Plan 1 (4000 Rupees = 400,000 paise)
        String plan1Id = createPlan(ownerToken, "Plan 1", 30, 400000L);

        // Create Plan 2 (1500 Rupees = 150,000 paise)
        String plan2Id = createPlan(ownerToken, "Plan 2", 30, 150000L);

        // Create Member 1 with Plan 1 and no payment (Due 400000 paise)
        createMember(ownerToken, "Member 1", "9800000001", plan1Id);

        // Create Member 2 with Plan 2 and no payment (Due 150000 paise)
        createMember(ownerToken, "Member 2", "9800000002", plan2Id);

        // GET /api/dashboard
        MvcResult dashboardResult = mockMvc.perform(get("/api/dashboard")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode dashboardData = objectMapper.readTree(dashboardResult.getResponse().getContentAsString()).path("data");

        // 1. Total due must be 550000 paise (400000 + 150000)
        long totalDue = dashboardData.path("totalDue").asLong();
        assertThat(totalDue).isEqualTo(550000L);

        // 2. New joinings (this month) must count both members created today
        long newJoinings = dashboardData.path("newJoinings").asLong();
        assertThat(newJoinings).isEqualTo(2L);
    }

    @Test
    @DisplayName("Symptom 3: Freshly registered gym gets 14-day trial with computed daysRemaining")
    void testFreshGymSubscriptionTrial() throws Exception {
        LocalDate todayKolkata = LocalDate.now(ZoneId.of("Asia/Kolkata"));

        // Register gym
        JsonNode data = registerGymViaOtpToken(
                mockMvc, objectMapper, "Fit Life", "Owner Fit", "9876543299", "owner@fitlife.com");
        String ownerToken = "Bearer " + data.path("accessToken").asText();

        // 1. Check gym profile API
        MvcResult profileResult = mockMvc.perform(get("/api/gym/profile")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode profileData = objectMapper.readTree(profileResult.getResponse().getContentAsString()).path("data");
        String validTillStr = profileData.path("subscriptionValidTill").asText();
        LocalDate validTill = LocalDate.parse(validTillStr);

        assertThat(validTill).isEqualTo(todayKolkata.plusDays(14));

        long daysRemaining = profileData.path("daysRemaining").asLong();
        assertThat(daysRemaining).isEqualTo(14L);

        // 2. Check dashboard API subscriptionDaysRemaining
        mockMvc.perform(get("/api/dashboard")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.subscriptionDaysRemaining").value(14));
    }

    @Test
    @DisplayName("Dashboard cache is evicted on member create, renew, payment, and reversal")
    void testDashboardCacheEvictionOnMemberAndPaymentWrites() throws Exception {
        JsonNode data = registerGymViaOtpToken(
                mockMvc, objectMapper, "Cache Gym", "Owner Cache", "9812999999", "owner@cachegym.com");
        String ownerToken = "Bearer " + data.path("accessToken").asText();

        // Prime cache with empty dashboard
        mockMvc.perform(get("/api/dashboard").header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalDue").value(0))
                .andExpect(jsonPath("$.data.todayCollection").value(0));

        // Create plan (200000 paise)
        String planId = createPlan(ownerToken, "Monthly Plan", 30, 200000L);

        // 1. Create member -> cache must be evicted immediately
        JsonNode memberData = createMember(ownerToken, "John Doe", "9800009999", planId);
        String memberId = memberData.path("id").asText();
        String membershipId = memberData.path("currentMembership").path("id").asText();

        mockMvc.perform(get("/api/dashboard").header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalDue").value(200000L));

        // 2. Collect partial payment of 50000 paise -> cache must be evicted
        com.gymapp.module.payment.dto.CreatePaymentRequest payReq = new com.gymapp.module.payment.dto.CreatePaymentRequest();
        payReq.setMemberId(memberId);
        payReq.setMembershipId(membershipId);
        payReq.setAmountPaise(50000L);
        payReq.setMode("CASH");

        MvcResult payResult = mockMvc.perform(post("/api/payments")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payReq)))
                .andExpect(status().isOk())
                .andReturn();

        String paymentId = objectMapper.readTree(payResult.getResponse().getContentAsString()).path("data").path("id").asText();

        mockMvc.perform(get("/api/dashboard").header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalDue").value(150000L))
                .andExpect(jsonPath("$.data.todayCollection").value(50000L));

        // 3. Reverse payment -> cache must be evicted and due restored
        mockMvc.perform(post("/api/payments/" + paymentId + "/reverse")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Test reversal\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/dashboard").header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalDue").value(200000L));

        // 4. Renew membership -> cache must be evicted and due incremented
        com.gymapp.module.member.dto.RenewMembershipRequest renewReq = new com.gymapp.module.member.dto.RenewMembershipRequest();
        renewReq.setPlanId(planId);

        mockMvc.perform(post("/api/members/" + memberId + "/renew")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(renewReq)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/dashboard").header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalDue").value(400000L));
    }

    private String createPlan(String token, String name, int durationDays, long pricePaise) throws Exception {
        PlanRequest req = new PlanRequest();
        req.setName(name);
        req.setDurationDays(durationDays);
        req.setPricePaise(pricePaise);
        MvcResult res = mockMvc.perform(post("/api/plans")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated()).andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).path("data").path("id").asText();
    }

    private JsonNode createMember(String token, String name, String phone, String planId) throws Exception {
        CreateMemberRequest req = new CreateMemberRequest();
        req.setName(name);
        req.setPhone(phone);
        req.setPlanId(planId);
        MvcResult res = mockMvc.perform(post("/api/members")
                        .header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).path("data");
    }
}
