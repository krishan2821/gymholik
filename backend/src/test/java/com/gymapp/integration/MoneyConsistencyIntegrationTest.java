package com.gymapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.module.member.dto.ApplyDiscountRequest;
import com.gymapp.module.member.dto.CreateMemberRequest;
import com.gymapp.module.member.dto.RenewMembershipRequest;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
import com.gymapp.module.member.service.MoneyRepairMigrationService;
import com.gymapp.module.payment.dto.CreatePaymentRequest;
import com.gymapp.module.payment.dto.ReversePaymentRequest;
import com.gymapp.module.payment.dto.ReversalReasonCode;
import com.gymapp.module.payment.job.MoneyConsistencyNightlyJob;
import com.gymapp.module.payment.repository.PaymentRepository;
import com.gymapp.module.plan.dto.PlanRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

public class MoneyConsistencyIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private MembershipRepository membershipRepository;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private MoneyConsistencyNightlyJob moneyConsistencyNightlyJob;

    @Autowired
    private MoneyRepairMigrationService moneyRepairMigrationService;

    private String gymId;
    private String ownerToken;
    private String planAId;
    private String planBId;

    @BeforeEach
    void setUpGym() throws Exception {
        String phone = "98" + String.format("%08d", Math.abs(java.util.concurrent.ThreadLocalRandom.current().nextInt(100000000)));
        String email = "consistency_" + System.nanoTime() + "@test.com";
        JsonNode data = registerGymViaOtpToken(
                mockMvc, objectMapper,
                "Consistency Gym", "Consistency Owner", phone, email
        );
        gymId = data.path("user").path("gymId").asText();
        ownerToken = "Bearer " + data.path("accessToken").asText();

        // Create Plan A (5000 Rs = 500,000 paise, 30 days)
        PlanRequest planReqA = new PlanRequest();
        planReqA.setName("Standard Plan");
        planReqA.setPricePaise(500000L);
        planReqA.setDurationDays(30);

        MvcResult pResA = mockMvc.perform(post("/api/plans")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(planReqA)))
                .andExpect(status().isCreated())
                .andReturn();
        planAId = objectMapper.readTree(pResA.getResponse().getContentAsString()).path("data").path("id").asText();

        // Create Plan B (10000 Rs = 1,000,000 paise, 90 days)
        PlanRequest planReqB = new PlanRequest();
        planReqB.setName("Quarterly Plan");
        planReqB.setPricePaise(1000000L);
        planReqB.setDurationDays(90);

        MvcResult pResB = mockMvc.perform(post("/api/plans")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(planReqB)))
                .andExpect(status().isCreated())
                .andReturn();
        planBId = objectMapper.readTree(pResB.getResponse().getContentAsString()).path("data").path("id").asText();
    }

    private void assertInvariants() {
        MoneyConsistencyNightlyJob.InvariantReport report = moneyConsistencyNightlyJob.checkInvariantsForGym(gymId);
        assertFalse(report.hasViolations(), "Violations detected: " + report.getViolations());
    }

    @Test
    void testMoneyConsistencyFullCycle() throws Exception {
        // a) Create member with partial payment: stored paid and due match payment
        CreateMemberRequest createReq = new CreateMemberRequest();
        createReq.setName("Alice Consistent");
        createReq.setPhone("9911223344");
        createReq.setGender("FEMALE");
        createReq.setPlanId(planAId);
        createReq.setPaidAmount(200000L); // paid 2,000 of 5,000
        createReq.setPaymentMode("CASH");
        createReq.setStartDate(LocalDate.now());

        MvcResult createRes = mockMvc.perform(post("/api/members")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode memberNode = objectMapper.readTree(createRes.getResponse().getContentAsString()).path("data");
        String memberId = memberNode.path("id").asText();
        String mem1Id = memberNode.path("currentMembership").path("id").asText();

        Membership mem1 = membershipRepository.findByIdAndGymId(mem1Id, gymId).orElseThrow();
        assertEquals(200000L, mem1.getPaidPaise());
        assertEquals(300000L, mem1.getDuePaise());

        Member member = memberRepository.findByIdAndGymId(memberId, gymId).orElseThrow();
        assertEquals(300000L, member.getCurrentDuePaise());
        assertInvariants();

        // b) Second payment towards the same membership: paid and due update correctly
        CreatePaymentRequest pay2Req = new CreatePaymentRequest();
        pay2Req.setMemberId(memberId);
        pay2Req.setMembershipId(mem1Id);
        pay2Req.setAmountPaise(100000L); // paid 1,000 more
        pay2Req.setMode("UPI");
        pay2Req.setReferenceNo("UPI-TXN-1001");

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pay2Req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.amountPaise", is(100000)));

        mem1 = membershipRepository.findByIdAndGymId(mem1Id, gymId).orElseThrow();
        assertEquals(300000L, mem1.getPaidPaise());
        assertEquals(200000L, mem1.getDuePaise());

        member = memberRepository.findByIdAndGymId(memberId, gymId).orElseThrow();
        assertEquals(200000L, member.getCurrentDuePaise());
        assertInvariants();

        // c) Renew membership while first membership still has a due: dues list shows both or the total due, payments are attributed to the right membership
        RenewMembershipRequest renewReq = new RenewMembershipRequest();
        renewReq.setPlanId(planBId);
        renewReq.setPaidAmount(400000L); // paid 4,000 of 10,000
        renewReq.setPaymentMode("CARD");
        renewReq.setStartDate(LocalDate.now().plusDays(31));

        MvcResult renewRes = mockMvc.perform(post("/api/members/" + memberId + "/renew")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(renewReq)))
                .andExpect(status().isOk())
                .andReturn();

        String mem2Id = objectMapper.readTree(renewRes.getResponse().getContentAsString()).path("data").path("id").asText();

        mem1 = membershipRepository.findByIdAndGymId(mem1Id, gymId).orElseThrow();
        Membership mem2 = membershipRepository.findByIdAndGymId(mem2Id, gymId).orElseThrow();
        assertEquals(200000L, mem1.getDuePaise());
        assertEquals(400000L, mem2.getPaidPaise());
        assertEquals(600000L, mem2.getDuePaise());

        member = memberRepository.findByIdAndGymId(memberId, gymId).orElseThrow();
        // Total member due = 200,000 + 600,000 = 800,000 paise
        assertEquals(800000L, member.getCurrentDuePaise());
        assertInvariants();

        // Check GET /api/dues shows 1 grouped entry for member with total due 800,000 and memberships list
        mockMvc.perform(get("/api/dues")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()", is(1)))
                .andExpect(jsonPath("$.data.items[0].memberId", is(memberId)))
                .andExpect(jsonPath("$.data.items[0].duePaise", is(800000)))
                .andExpect(jsonPath("$.data.items[0].memberships.length()", is(2)));

        // Check GET /api/members/{id}/payment-context returns both memberships with dues
        mockMvc.perform(get("/api/members/" + memberId + "/payment-context")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.memberId", is(memberId)))
                .andExpect(jsonPath("$.data.totalDuePaise", is(800000)))
                .andExpect(jsonPath("$.data.memberships.length()", is(2)));

        // Test payment without specifying membershipId: defaults to oldest membership with due (mem1)
        CreatePaymentRequest payOldestReq = new CreatePaymentRequest();
        payOldestReq.setMemberId(memberId);
        payOldestReq.setAmountPaise(200000L); // clear mem1's due
        payOldestReq.setMode("CASH");

        MvcResult payOldestRes = mockMvc.perform(post("/api/payments")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payOldestReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.membershipId", is(mem1Id)))
                .andReturn();

        String paymentIdToReverse = objectMapper.readTree(payOldestRes.getResponse().getContentAsString()).path("data").path("id").asText();

        mem1 = membershipRepository.findByIdAndGymId(mem1Id, gymId).orElseThrow();
        mem2 = membershipRepository.findByIdAndGymId(mem2Id, gymId).orElseThrow();
        assertEquals(0L, mem1.getDuePaise());
        assertEquals(500000L, mem1.getPaidPaise());
        assertEquals(600000L, mem2.getDuePaise());

        member = memberRepository.findByIdAndGymId(memberId, gymId).orElseThrow();
        assertEquals(600000L, member.getCurrentDuePaise());
        assertInvariants();

        // d) Overpayment attempt is rejected
        CreatePaymentRequest overpayReq = new CreatePaymentRequest();
        overpayReq.setMemberId(memberId);
        overpayReq.setMembershipId(mem2Id);
        overpayReq.setAmountPaise(700000L); // due is only 600,000 -> exceeds due!
        overpayReq.setMode("CASH");

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overpayReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success", is(false)));

        assertInvariants();

        // e) Reversal restores membership due and member currentDuePaise
        ReversePaymentRequest revReq = new ReversePaymentRequest();
        revReq.setReasonCode(ReversalReasonCode.WRONG_ENTRY);
        revReq.setNote("Entered wrong cash receipt number");

        mockMvc.perform(post("/api/payments/" + paymentIdToReverse + "/reverse")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(revReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type", is("REVERSAL")));

        mem1 = membershipRepository.findByIdAndGymId(mem1Id, gymId).orElseThrow();
        assertEquals(200000L, mem1.getDuePaise());
        assertEquals(300000L, mem1.getPaidPaise());

        member = memberRepository.findByIdAndGymId(memberId, gymId).orElseThrow();
        assertEquals(800000L, member.getCurrentDuePaise()); // 200,000 + 600,000 restored
        assertInvariants();

        // f) Discount reduces membership due and member currentDuePaise
        ApplyDiscountRequest discReq = ApplyDiscountRequest.builder()
                .discountPaise(50000L) // 500 Rs discount on mem2
                .reason("Loyalty discount for upfront payment")
                .build();

        mockMvc.perform(post("/api/memberships/" + mem2Id + "/discount")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(discReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.discountPaise", is(50000)))
                .andExpect(jsonPath("$.data.duePaise", is(550000)));

        mem2 = membershipRepository.findByIdAndGymId(mem2Id, gymId).orElseThrow();
        assertEquals(50000L, mem2.getDiscountPaise());
        assertEquals(550000L, mem2.getDuePaise());

        member = memberRepository.findByIdAndGymId(memberId, gymId).orElseThrow();
        // mem1 due (200,000) + mem2 due (550,000) = 750,000 paise
        assertEquals(750000L, member.getCurrentDuePaise());
        assertInvariants();

        // g) Invariant check passes across all members after all the above operations
        MoneyConsistencyNightlyJob.InvariantReport allReport = moneyConsistencyNightlyJob.checkInvariantsForGym(gymId);
        assertFalse(allReport.hasViolations(), "Violations in gym: " + allReport.getViolations());

        // Also verify MoneyRepairMigrationService dry run and live run
        MoneyRepairMigrationService.MoneyRepairReport dryReport = moneyRepairMigrationService.runRepair(gymId, true);
        assertTrue(dryReport.isDryRun());
        assertEquals(0, dryReport.getMembershipMismatches().size());
        assertEquals(0, dryReport.getMemberMismatches().size());

        MoneyRepairMigrationService.MoneyRepairReport liveReport = moneyRepairMigrationService.runRepair(gymId, false);
        assertFalse(liveReport.isDryRun());
        assertEquals(0, liveReport.getMembershipMismatches().size());
        assertEquals(0, liveReport.getMemberMismatches().size());
    }
}
