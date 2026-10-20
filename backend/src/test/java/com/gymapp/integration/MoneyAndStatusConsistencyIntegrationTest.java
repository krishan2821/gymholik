package com.gymapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.module.member.dto.CreateMemberRequest;
import com.gymapp.module.member.dto.RenewMembershipRequest;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.job.MembershipStatusJob;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
import com.gymapp.module.notification.job.MembershipReminderJob;
import com.gymapp.module.notification.repository.ReminderLogRepository;
import com.gymapp.module.payment.dto.CreatePaymentRequest;
import com.gymapp.module.payment.entity.Payment;
import com.gymapp.module.payment.job.MoneyConsistencyNightlyJob;
import com.gymapp.module.payment.repository.PaymentRepository;
import com.gymapp.module.plan.dto.PlanRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicReference;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@org.springframework.context.annotation.Import(MoneyAndStatusConsistencyIntegrationTest.TestClockConfig.class)
public class MoneyAndStatusConsistencyIntegrationTest extends AbstractIntegrationTest {

    public static class TestClock extends Clock {
        private final ZoneId zone = ZoneId.of("Asia/Kolkata");
        private final AtomicReference<Instant> currentInstant = new AtomicReference<>(
                ZonedDateTime.of(2026, 10, 12, 10, 0, 0, 0, ZoneId.of("Asia/Kolkata")).toInstant()
        );

        public void setInstant(Instant instant) {
            this.currentInstant.set(instant);
        }

        public void setZonedDateTime(ZonedDateTime zdt) {
            this.currentInstant.set(zdt.toInstant());
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return currentInstant.get();
        }
    }

    @org.springframework.boot.test.context.TestConfiguration
    public static class TestClockConfig {
        @org.springframework.context.annotation.Bean
        @org.springframework.context.annotation.Primary
        public TestClock testClock() {
            return new TestClock();
        }
    }

    private static final ZoneId KOLKATA = ZoneId.of("Asia/Kolkata");

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
    private ReminderLogRepository reminderLogRepository;

    @Autowired
    private MoneyConsistencyNightlyJob moneyConsistencyNightlyJob;

    @Autowired
    private MembershipStatusJob membershipStatusJob;

    @Autowired
    private MembershipReminderJob membershipReminderJob;

    @Autowired
    private com.gymapp.module.member.service.MembershipLedgerService membershipLedgerService;

    @Autowired
    private TestClock testClock;

    private String gymId;
    private String ownerToken;
    private String quarterlyPlanId;
    private String annualPlanId;

    @BeforeEach
    void setUp() throws Exception {
        // Initial test time: 12 Oct 2026, 10:00 AM IST
        ZonedDateTime initialTime = ZonedDateTime.of(2026, 10, 12, 10, 0, 0, 0, KOLKATA);
        testClock.setZonedDateTime(initialTime);

        String phone = "98" + String.format("%08d", Math.abs(ThreadLocalRandom.current().nextInt(100000000)));
        String email = "money_status_" + System.nanoTime() + "@test.com";

        JsonNode gymData = registerGymViaOtpToken(
                mockMvc, objectMapper,
                "Consistency Club", "Owner consistency", phone, email
        );
        gymId = gymData.path("user").path("gymId").asText();
        ownerToken = "Bearer " + gymData.path("accessToken").asText();

        // Quarterly Plan (4000 Rs = 400,000 paise, 90 days)
        PlanRequest qReq = new PlanRequest();
        qReq.setName("Quarterly 4000");
        qReq.setPricePaise(400000L);
        qReq.setDurationDays(90);

        MvcResult qRes = mockMvc.perform(post("/api/plans")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(qReq)))
                .andExpect(status().isCreated())
                .andReturn();
        quarterlyPlanId = objectMapper.readTree(qRes.getResponse().getContentAsString()).path("data").path("id").asText();

        // Annual Plan (12000 Rs = 1,200,000 paise, 365 days)
        PlanRequest aReq = new PlanRequest();
        aReq.setName("Annual 12000");
        aReq.setPricePaise(1200000L);
        aReq.setDurationDays(365);

        MvcResult aRes = mockMvc.perform(post("/api/plans")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(aReq)))
                .andExpect(status().isCreated())
                .andReturn();
        annualPlanId = objectMapper.readTree(aRes.getResponse().getContentAsString()).path("data").path("id").asText();
    }

    private void assertInvariants() {
        MoneyConsistencyNightlyJob.InvariantReport report = moneyConsistencyNightlyJob.checkInvariantsForGym(gymId);
        assertFalse(report.hasViolations(), "Violations detected: " + report.getViolations());
    }

    @Test
    @DisplayName("Comprehensive 7(a)-(i) Money, Membership Status and Timezone Consistency Verification")
    void testComprehensiveMoneyAndStatusConsistency() throws Exception {
        LocalDate oct12 = LocalDate.of(2026, 10, 12);

        // -------------------------------------------------------------------------
        // 7(a): Sequence of user data:
        // 1. Add member on Quarterly 4000 with NO payment
        // -------------------------------------------------------------------------
        CreateMemberRequest createReq = new CreateMemberRequest();
        createReq.setName("Rahul Dev");
        createReq.setPhone("9812340001");
        createReq.setGender("MALE");
        createReq.setPlanId(quarterlyPlanId);
        createReq.setStartDate(oct12);
        createReq.setPaidAmount(0L);

        MvcResult createRes = mockMvc.perform(post("/api/members")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode m1Node = objectMapper.readTree(createRes.getResponse().getContentAsString()).path("data");
        String memberId = m1Node.path("id").asText();
        String mem1Id = m1Node.path("currentMembership").path("id").asText();

        Membership mem1 = membershipRepository.findByIdAndGymId(mem1Id, gymId).orElseThrow();
        assertEquals(0L, mem1.getPaidPaise());
        assertEquals(400000L, mem1.getDuePaise());
        assertEquals(Membership.MembershipStatus.ACTIVE, mem1.getStatus());
        assertEquals(oct12, mem1.getStartDate());
        LocalDate mem1Expiry = mem1.getExpiryDate();

        Member member = memberRepository.findByIdAndGymId(memberId, gymId).orElseThrow();
        assertEquals(400000L, member.getCurrentDuePaise());
        assertEquals(mem1Id, member.getCurrentMembershipId());
        assertEquals(mem1Expiry, member.getCurrentExpiry());
        assertInvariants();

        // 2. Renew to Quarterly (pay 4000) starting right after mem1
        LocalDate mem2Start = mem1Expiry.plusDays(1);
        RenewMembershipRequest renew1Req = new RenewMembershipRequest();
        renew1Req.setPlanId(quarterlyPlanId);
        renew1Req.setPaidAmount(400000L);
        renew1Req.setPaymentMode("UPI");
        renew1Req.setStartDate(mem2Start);

        MvcResult r1Res = mockMvc.perform(post("/api/members/" + memberId + "/renew")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(renew1Req)))
                .andExpect(status().isOk())
                .andReturn();

        String mem2Id = objectMapper.readTree(r1Res.getResponse().getContentAsString()).path("data").path("id").asText();
        Membership mem2 = membershipRepository.findByIdAndGymId(mem2Id, gymId).orElseThrow();
        assertEquals(400000L, mem2.getPaidPaise());
        assertEquals(0L, mem2.getDuePaise());
        assertEquals(Membership.MembershipStatus.UPCOMING, mem2.getStatus(), "Future membership must have status UPCOMING");
        LocalDate mem2Expiry = mem2.getExpiryDate();

        member = memberRepository.findByIdAndGymId(memberId, gymId).orElseThrow();
        assertEquals(400000L, member.getCurrentDuePaise(), "Total due is still 400,000 paise from mem1");
        assertEquals(mem1Id, member.getCurrentMembershipId(), "Active membership covering today is mem1");
        assertEquals(mem2Expiry, member.getCurrentExpiry(), "End of coverage extends to mem2 expiry");
        assertInvariants();

        // 3. Renew to Annual 12000 (pay 12000) starting right after mem2
        LocalDate mem3Start = mem2Expiry.plusDays(1);
        RenewMembershipRequest renew2Req = new RenewMembershipRequest();
        renew2Req.setPlanId(annualPlanId);
        renew2Req.setPaidAmount(1200000L);
        renew2Req.setPaymentMode("CARD");
        renew2Req.setStartDate(mem3Start);

        MvcResult r2Res = mockMvc.perform(post("/api/members/" + memberId + "/renew")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(renew2Req)))
                .andExpect(status().isOk())
                .andReturn();

        String mem3Id = objectMapper.readTree(r2Res.getResponse().getContentAsString()).path("data").path("id").asText();
        Membership mem3 = membershipRepository.findByIdAndGymId(mem3Id, gymId).orElseThrow();
        assertEquals(1200000L, mem3.getPaidPaise());
        assertEquals(0L, mem3.getDuePaise());
        assertEquals(Membership.MembershipStatus.UPCOMING, mem3.getStatus());
        LocalDate mem3Expiry = mem3.getExpiryDate();

        member = memberRepository.findByIdAndGymId(memberId, gymId).orElseThrow();
        assertEquals(400000L, member.getCurrentDuePaise());
        assertEquals(mem1Id, member.getCurrentMembershipId());
        assertEquals(mem3Expiry, member.getCurrentExpiry());
        assertInvariants();

        // 4. Pay the first Quarterly 4000 (towards mem1)
        CreatePaymentRequest payFirstReq = new CreatePaymentRequest();
        payFirstReq.setMemberId(memberId);
        payFirstReq.setMembershipId(mem1Id);
        payFirstReq.setAmountPaise(400000L);
        payFirstReq.setMode("CASH");

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payFirstReq)))
                .andExpect(status().isOk());

        mem1 = membershipRepository.findByIdAndGymId(mem1Id, gymId).orElseThrow();
        mem2 = membershipRepository.findByIdAndGymId(mem2Id, gymId).orElseThrow();
        mem3 = membershipRepository.findByIdAndGymId(mem3Id, gymId).orElseThrow();

        assertEquals(0L, mem1.getDuePaise());
        assertEquals(0L, mem2.getDuePaise());
        assertEquals(0L, mem3.getDuePaise());
        assertEquals(Membership.MembershipStatus.ACTIVE, mem1.getStatus());
        assertEquals(Membership.MembershipStatus.UPCOMING, mem2.getStatus());
        assertEquals(Membership.MembershipStatus.UPCOMING, mem3.getStatus());

        member = memberRepository.findByIdAndGymId(memberId, gymId).orElseThrow();
        assertEquals(0L, member.getCurrentDuePaise(), "All memberships fully paid: currentDuePaise must be 0 (never negative)");
        assertEquals(mem1Id, member.getCurrentMembershipId());
        assertEquals(mem3Expiry, member.getCurrentExpiry());
        assertInvariants();

        // -------------------------------------------------------------------------
        // 7(c): Advance-renewed members get no reminder for the old membership
        // and do not appear in "expiring in 5 days"
        // At 3 days before mem1Expiry, member.currentExpiry is in 2028 (end of coverage)
        // -------------------------------------------------------------------------
        testClock.setInstant(mem1Expiry.minusDays(3).atTime(9, 0).atZone(KOLKATA).toInstant());

        // Check GET /api/dashboard: expiringSoon count is 0 and list does not include member
        mockMvc.perform(get("/api/dashboard")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.expiringSoon", is(0)))
                .andExpect(jsonPath("$.data.expiringSoonList", hasSize(0)));

        // Run reminder job
        membershipReminderJob.processReminders();
        boolean reminderLogged = reminderLogRepository.existsByGymIdAndMembershipIdAndType(gymId, mem1Id, "EXPIRING_IN_3_DAYS");
        assertFalse(reminderLogged, "No reminder should be logged for advance-renewed member's old membership");
        assertInvariants();

        // -------------------------------------------------------------------------
        // 7(b): A day later the status job turns the next one ACTIVE
        // Advance clock past mem1Expiry to mem2Start (e.g. 11 Jan 2027)
        // -------------------------------------------------------------------------
        testClock.setInstant(mem2Start.atTime(1, 0).atZone(KOLKATA).toInstant());
        membershipStatusJob.maintainMembershipStatuses();

        mem1 = membershipRepository.findByIdAndGymId(mem1Id, gymId).orElseThrow();
        mem2 = membershipRepository.findByIdAndGymId(mem2Id, gymId).orElseThrow();
        mem3 = membershipRepository.findByIdAndGymId(mem3Id, gymId).orElseThrow();

        assertEquals(Membership.MembershipStatus.EXPIRED, mem1.getStatus(), "mem1 has expired");
        assertEquals(Membership.MembershipStatus.ACTIVE, mem2.getStatus(), "mem2 has started and is now ACTIVE");
        assertEquals(Membership.MembershipStatus.UPCOMING, mem3.getStatus(), "mem3 is still UPCOMING");

        member = memberRepository.findByIdAndGymId(memberId, gymId).orElseThrow();
        assertEquals(mem2Id, member.getCurrentMembershipId(), "Active membership is now mem2");
        assertInvariants();

        // -------------------------------------------------------------------------
        // 7(d): Payment saved with Clock fixed to 00:30 IST on 19 Oct 2026 has
        // paidAt on 19 Oct and a real time
        // -------------------------------------------------------------------------
        ZonedDateTime time19Oct = ZonedDateTime.of(2026, 10, 19, 0, 30, 0, 0, KOLKATA);
        testClock.setZonedDateTime(time19Oct);
        membershipLedgerService.recalculate(gymId, memberId);
        assertInvariants();

        // Create a separate member with due 100000 paise to test payments
        CreateMemberRequest m2Req = new CreateMemberRequest();
        m2Req.setName("Bikram Test");
        m2Req.setPhone("9812340002");
        m2Req.setGender("MALE");
        m2Req.setPlanId(quarterlyPlanId);
        m2Req.setStartDate(LocalDate.of(2026, 10, 19));
        m2Req.setPaidAmount(300000L); // 100000 due

        MvcResult m2Res = mockMvc.perform(post("/api/members")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(m2Req)))
                .andExpect(status().isOk())
                .andReturn();

        String member2Id = objectMapper.readTree(m2Res.getResponse().getContentAsString()).path("data").path("id").asText();
        String mem2TestId = objectMapper.readTree(m2Res.getResponse().getContentAsString()).path("data").path("currentMembership").path("id").asText();

        // Pay 50000 paise without paymentDate -> server uses Clock
        CreatePaymentRequest payNoDateReq = new CreatePaymentRequest();
        payNoDateReq.setMemberId(member2Id);
        payNoDateReq.setMembershipId(mem2TestId);
        payNoDateReq.setAmountPaise(50000L);
        payNoDateReq.setMode("UPI");

        MvcResult pRes = mockMvc.perform(post("/api/payments")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payNoDateReq)))
                .andExpect(status().isOk())
                .andReturn();

        String payId = objectMapper.readTree(pRes.getResponse().getContentAsString()).path("data").path("id").asText();
        Payment savedPay = paymentRepository.findByIdAndGymId(payId, gymId).orElseThrow();
        assertNotNull(savedPay.getPaidAt());
        ZonedDateTime kolkataPaidAt = savedPay.getPaidAt().atZone(KOLKATA);
        assertEquals(LocalDate.of(2026, 10, 19), kolkataPaidAt.toLocalDate(), "Payment date must be 19 Oct in IST");
        assertEquals(0, kolkataPaidAt.getHour(), "Payment hour must be 00");
        assertEquals(30, kolkataPaidAt.getMinute(), "Payment minute must be 30");
        assertInvariants();

        // -------------------------------------------------------------------------
        // 7(e): Backdated payment is stored at 12:00 IST
        // -------------------------------------------------------------------------
        CreatePaymentRequest backdatedReq = new CreatePaymentRequest();
        backdatedReq.setMemberId(member2Id);
        backdatedReq.setMembershipId(mem2TestId);
        backdatedReq.setAmountPaise(20000L);
        backdatedReq.setMode("CASH");
        backdatedReq.setPaymentDate(LocalDate.of(2026, 10, 14)); // 5 days back

        MvcResult bdRes = mockMvc.perform(post("/api/payments")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(backdatedReq)))
                .andExpect(status().isOk())
                .andReturn();

        String bdPayId = objectMapper.readTree(bdRes.getResponse().getContentAsString()).path("data").path("id").asText();
        Payment bdPay = paymentRepository.findByIdAndGymId(bdPayId, gymId).orElseThrow();
        ZonedDateTime bdKolkata = bdPay.getPaidAt().atZone(KOLKATA);
        assertEquals(LocalDate.of(2026, 10, 14), bdKolkata.toLocalDate());
        assertEquals(12, bdKolkata.getHour(), "Backdated payment must be stored at 12:00 IST");
        assertEquals(0, bdKolkata.getMinute());
        assertInvariants();

        // -------------------------------------------------------------------------
        // 7(f): Future date rejected
        // -------------------------------------------------------------------------
        CreatePaymentRequest futureReq = new CreatePaymentRequest();
        futureReq.setMemberId(member2Id);
        futureReq.setMembershipId(mem2TestId);
        futureReq.setAmountPaise(10000L);
        futureReq.setMode("CASH");
        futureReq.setPaymentDate(LocalDate.of(2026, 10, 25)); // Future relative to 19 Oct

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(futureReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success", is(false)));
        assertInvariants();

        // -------------------------------------------------------------------------
        // 7(g): Membership of another member or gym rejected (404)
        // -------------------------------------------------------------------------
        CreatePaymentRequest crossReq = new CreatePaymentRequest();
        crossReq.setMemberId(member2Id);
        crossReq.setMembershipId(mem1Id); // mem1 belongs to memberId, not member2Id!
        crossReq.setAmountPaise(10000L);
        crossReq.setMode("CASH");

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(crossReq)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success", is(false)));
        assertInvariants();

        // -------------------------------------------------------------------------
        // 7(h): Paid cannot exceed total minus discount
        // member2 due is currently: 400,000 - 300,000 - 50,000 - 20,000 = 30,000 paise
        // -------------------------------------------------------------------------
        CreatePaymentRequest overpayReq = new CreatePaymentRequest();
        overpayReq.setMemberId(member2Id);
        overpayReq.setMembershipId(mem2TestId);
        overpayReq.setAmountPaise(35000L); // 35,000 exceeds 30,000 due!
        overpayReq.setMode("CASH");

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overpayReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success", is(false)));
        assertInvariants();

        // -------------------------------------------------------------------------
        // 7(i): Summary, dues, picker and dashboard agree
        // -------------------------------------------------------------------------
        // Exactly 30,000 paise due from member2 across the entire gym!
        // Check GET /api/payments/summary
        mockMvc.perform(get("/api/payments/summary")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pendingDuePaise", is(30000)))
                .andExpect(jsonPath("$.data.pendingMembersCount", is(1)));

        // Check GET /api/dues
        mockMvc.perform(get("/api/dues")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalDuePaise", is(30000)))
                .andExpect(jsonPath("$.data.count", is(1)))
                .andExpect(jsonPath("$.data.items.length()", is(1)))
                .andExpect(jsonPath("$.data.items[0].duePaise", is(30000)));

        // Check GET /api/dashboard
        mockMvc.perform(get("/api/dashboard")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalDue", is(30000)));

        // Check GET /api/members/{id}/fees for member2
        mockMvc.perform(get("/api/members/" + member2Id + "/fees")
                        .header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.dueTotalPaise", is(30000)))
                .andExpect(jsonPath("$.data.defaultMembershipId", is(mem2TestId)))
                .andExpect(jsonPath("$.data.memberships.length()", is(1)))
                .andExpect(jsonPath("$.data.memberships[0].duePaise", is(30000)));

        // Check defaultMembershipId works when omitting membershipId in POST /api/payments
        CreatePaymentRequest payDefaultReq = new CreatePaymentRequest();
        payDefaultReq.setMemberId(member2Id);
        // membershipId omitted!
        payDefaultReq.setAmountPaise(30000L); // clears remaining due
        payDefaultReq.setMode("CASH");

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payDefaultReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.membershipId", is(mem2TestId)));

        // Now gym has 0 dues everywhere
        mockMvc.perform(get("/api/payments/summary").header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pendingDuePaise", is(0)))
                .andExpect(jsonPath("$.data.pendingMembersCount", is(0)));

        mockMvc.perform(get("/api/dues").header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalDuePaise", is(0)))
                .andExpect(jsonPath("$.data.count", is(0)));

        mockMvc.perform(get("/api/dashboard").header("Authorization", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalDue", is(0)));

        assertInvariants();
    }
}
