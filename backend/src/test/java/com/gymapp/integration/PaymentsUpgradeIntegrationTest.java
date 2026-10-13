package com.gymapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.common.TenantContext;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.dashboard.dto.DashboardResponse;
import com.gymapp.module.dashboard.service.DashboardService;
import com.gymapp.module.member.dto.CreateMemberRequest;
import com.gymapp.module.member.dto.RenewMembershipRequest;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
import com.gymapp.module.payment.dto.CreatePaymentRequest;
import com.gymapp.module.payment.dto.PaymentListResponse;
import com.gymapp.module.payment.dto.PaymentResponse;
import com.gymapp.module.payment.dto.PaymentSummaryResponse;
import com.gymapp.module.payment.entity.Payment;
import com.gymapp.module.payment.repository.PaymentRepository;
import com.gymapp.module.payment.service.PaymentService;
import com.gymapp.module.plan.dto.PlanRequest;
import com.gymapp.security.JwtDetails;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.gymapp.module.audit.entity.AuditLog;
import com.gymapp.module.audit.repository.AuditLogRepository;
import com.gymapp.module.member.dto.ApplyDiscountRequest;
import com.gymapp.module.member.dto.UpdatePromisedDateRequest;
import com.gymapp.module.payment.dto.ReversePaymentRequest;
import com.gymapp.module.payment.dto.ReversalReasonCode;

import java.time.LocalDate;
import java.time.LocalDateTime;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.entity.GymAddress;
import com.gymapp.module.auth.entity.LegalIdType;
import com.gymapp.module.auth.repository.GymRepository;
import com.gymapp.module.payment.entity.DayClose;
import com.gymapp.module.payment.repository.DayCloseRepository;
import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class PaymentsUpgradeIntegrationTest extends AbstractIntegrationTest {

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
    private UserRepository userRepository;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private DashboardService dashboardService;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private GymRepository gymRepository;

    @Autowired
    private DayCloseRepository dayCloseRepository;

    private String gymA_Id;
    private String gymB_Id;
    private String gymA_OwnerToken;
    private String gymB_OwnerToken;
    private String gymA_StaffToken;
    private String gymA_StaffId;
    private String gymA_TrainerToken;
    private String gymA_TrainerId;

    private String gymA_PlanId;
    private long planPricePaise = 500000L; // 5000 rupees

    @BeforeAll
    void setup() throws Exception {
        // Register Gym A + Owner A
        JsonNode dataA = registerGymViaOtpToken(
                mockMvc, objectMapper,
                "Payments Test Gym A", "Owner A", "9100000001", "ownerA@paymenttest.com"
        );
        gymA_Id = dataA.path("user").path("gymId").asText();
        gymA_OwnerToken = "Bearer " + dataA.path("accessToken").asText();

        // Register Gym B + Owner B
        JsonNode dataB = registerGymViaOtpToken(
                mockMvc, objectMapper,
                "Payments Test Gym B", "Owner B", "9100000002", "ownerB@paymenttest.com"
        );
        gymB_Id = dataB.path("user").path("gymId").asText();
        gymB_OwnerToken = "Bearer " + dataB.path("accessToken").asText();

        // Create Plan for Gym A
        PlanRequest planReq = new PlanRequest();
        planReq.setName("Quarterly Plan");
        planReq.setDurationDays(90);
        planReq.setPricePaise(planPricePaise);

        MvcResult planRes = mockMvc.perform(post("/api/plans")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(planReq)))
                .andExpect(status().isCreated())
                .andReturn();
        gymA_PlanId = objectMapper.readTree(planRes.getResponse().getContentAsString())
                .path("data").path("id").asText();

        // Create Staff User in Gym A (must have active=true)
        User staffUser = User.builder()
                .gymId(gymA_Id)
                .name("Staff John")
                .phone("9100000003")
                .role("STAFF")
                .active(true)
                .status("ACTIVE")
                .build();
        staffUser = userRepository.save(staffUser);
        gymA_StaffId = staffUser.getId();
        gymA_StaffToken = bearerTokenForUser(staffUser.getId(), gymA_Id, "STAFF");

        // Create Trainer User in Gym A (must have active=true)
        User trainerUser = User.builder()
                .gymId(gymA_Id)
                .name("Trainer Mike")
                .phone("9100000004")
                .role("TRAINER")
                .active(true)
                .status("ACTIVE")
                .build();
        trainerUser = userRepository.save(trainerUser);
        gymA_TrainerId = trainerUser.getId();
        gymA_TrainerToken = bearerTokenForUser(trainerUser.getId(), gymA_Id, "TRAINER");
    }

    /**
     * Requirement 5: Invariant verification helper
     */
    private void assertFinancialInvariants(String gymId) {
        TenantContext.setGymId(gymId);

        // Populate SecurityContext with OWNER role for service checks
        var auth = new UsernamePasswordAuthenticationToken("test-owner", null, List.of(new SimpleGrantedAuthority("ROLE_OWNER")));
        auth.setDetails(new JwtDetails("test-owner", gymId, "OWNER"));
        SecurityContextHolder.getContext().setAuthentication(auth);

        List<Membership> memberships = membershipRepository.findByGymId(gymId);
        List<Member> members = memberRepository.findByGymId(gymId);
        List<Payment> payments = paymentRepository.findByGymId(gymId);

        // 1. For each membership, paidPaise = sum of payments (reversals negative)
        for (Membership m : memberships) {
            long expectedPaid = payments.stream()
                    .filter(p -> m.getId().equals(p.getMembershipId()))
                    .mapToLong(p -> "REVERSAL".equalsIgnoreCase(p.getType()) ? -p.getAmountPaise() : p.getAmountPaise())
                    .sum();
            assertEquals(expectedPaid, m.getPaidPaise(), "Membership " + m.getId() + " paidPaise must match sum of payments");

            // 2. duePaise = totalPaise - discountPaise(0 for now) - paidPaise, never negative
            long discount = m.getDiscountPaise();
            long expectedDue = m.getTotalPaise() - discount - m.getPaidPaise();
            assertEquals(expectedDue, m.getDuePaise(), "Membership " + m.getId() + " duePaise must match total - discount - paid");
            assertTrue(m.getDuePaise() >= 0, "Membership " + m.getId() + " duePaise must never be negative");
        }

        // 3. members.currentDuePaise = sum of due over the member's memberships
        for (Member member : members) {
            long expectedMemberDue = memberships.stream()
                    .filter(m -> member.getId().equals(m.getMemberId()))
                    .mapToLong(Membership::getDuePaise)
                    .sum();
            assertEquals(expectedMemberDue, member.getCurrentDuePaise(),
                    "Member " + member.getId() + " currentDuePaise must match sum of memberships due");
        }

        // 4. dashboard totalDue = sum of members.currentDuePaise
        DashboardResponse dashboard = dashboardService.getDashboardData();
        long expectedDashboardDue = members.stream()
                .mapToLong(Member::getCurrentDuePaise)
                .sum();
        assertEquals(expectedDashboardDue, dashboard.getTotalDue(),
                "Dashboard totalDue must match sum of members.currentDuePaise");

        // 5. summary collectedPaise equals the sum of listed payments for the same period
        for (String period : List.of("TODAY", "WEEK", "MONTH", "ALL")) {
            PaymentSummaryResponse summary = paymentService.getSummary(period, null, null);
            PaymentListResponse listResponse = paymentService.getPayments(period, null, null, null, null, PageRequest.of(0, 100));
            long sumListed = listResponse.getPayments().getContent().stream()
                    .mapToLong(PaymentResponse::getAmountPaise)
                    .sum();
            assertEquals(sumListed, summary.getCollectedPaise(),
                    "Summary collectedPaise must equal sum of listed payments for period " + period);
        }
    }

    @Test
    void testEndToEndFinancialInvariantsLifecycle() throws Exception {
        // Step 1: Create a member in Gym A
        CreateMemberRequest memberReq = new CreateMemberRequest();
        memberReq.setName("Vijay Kumar");
        memberReq.setPhone("9876543210");
        memberReq.setPlanId(gymA_PlanId);
        memberReq.setGender("MALE");

        MvcResult memberRes = mockMvc.perform(post("/api/members")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(memberReq)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode memberData = objectMapper.readTree(memberRes.getResponse().getContentAsString()).path("data");
        String memberId = memberData.path("id").asText();
        String membershipId = memberData.path("currentMembership").path("id").asText();

        assertFinancialInvariants(gymA_Id);

        // Step 2: Partial Payment of 200000 paise (CASH)
        CreatePaymentRequest pay1 = new CreatePaymentRequest();
        pay1.setMemberId(memberId);
        pay1.setMembershipId(membershipId);
        pay1.setAmountPaise(200000L);
        pay1.setMode("CASH");
        pay1.setReason("First installment");

        MvcResult pay1Res = mockMvc.perform(post("/api/payments")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pay1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.amountPaise", is(200000)))
                .andExpect(jsonPath("$.data.type", is("PAYMENT")))
                .andReturn();

        String payment1Id = objectMapper.readTree(pay1Res.getResponse().getContentAsString()).path("data").path("id").asText();
        assertFinancialInvariants(gymA_Id);

        // Step 3: Full Payment of remaining 300000 paise (UPI)
        CreatePaymentRequest pay2 = new CreatePaymentRequest();
        pay2.setMemberId(memberId);
        pay2.setMembershipId(membershipId);
        pay2.setAmountPaise(300000L);
        pay2.setMode("UPI");
        pay2.setReason("Second installment");

        MvcResult pay2Res = mockMvc.perform(post("/api/payments")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pay2)))
                .andExpect(status().isOk())
                .andReturn();

        String payment2Id = objectMapper.readTree(pay2Res.getResponse().getContentAsString()).path("data").path("id").asText();
        assertFinancialInvariants(gymA_Id);

        // Step 4: Overpayment rejected (due is 0 now)
        CreatePaymentRequest overpay = new CreatePaymentRequest();
        overpay.setMemberId(memberId);
        overpay.setMembershipId(membershipId);
        overpay.setAmountPaise(10000L);
        overpay.setMode("CASH");

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overpay)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("exceeds due amount")));

        assertFinancialInvariants(gymA_Id);

        // Step 5: Reverse Payment 2
        mockMvc.perform(post("/api/payments/" + payment2Id + "/reverse?notes=Test+Reversal")
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.type", is("REVERSAL")))
                .andExpect(jsonPath("$.data.reversalOfId", is(payment2Id)));

        assertFinancialInvariants(gymA_Id);

        // Step 6: Renew membership with payment
        RenewMembershipRequest renewReq = new RenewMembershipRequest();
        renewReq.setPlanId(gymA_PlanId);

        MvcResult renewRes = mockMvc.perform(post("/api/members/" + memberId + "/renew")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(renewReq)))
                .andExpect(status().isOk())
                .andReturn();

        String renewedMembershipId = objectMapper.readTree(renewRes.getResponse().getContentAsString())
                .path("data").path("id").asText();

        assertFinancialInvariants(gymA_Id);

        // Pay towards renewed membership (CARD)
        CreatePaymentRequest pay3 = new CreatePaymentRequest();
        pay3.setMemberId(memberId);
        pay3.setMembershipId(renewedMembershipId);
        pay3.setAmountPaise(250000L);
        pay3.setMode("CARD");

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pay3)))
                .andExpect(status().isOk());

        assertFinancialInvariants(gymA_Id);

        // Step 7: Apply discount to renewed membership and verify invariants still hold
        ApplyDiscountRequest discountReq = new ApplyDiscountRequest();
        discountReq.setDiscountPaise(100000L); // 1000 rs discount on remaining 2500 rs due
        discountReq.setReason("Good customer discount");

        mockMvc.perform(post("/api/memberships/" + renewedMembershipId + "/discount")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(discountReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.discountPaise", is(100000)))
                .andExpect(jsonPath("$.data.duePaise", is(150000)));

        assertFinancialInvariants(gymA_Id);
    }

    @Test
    void testCacheEvictionImmediateOnPayment() throws Exception {
        MvcResult sBefore = mockMvc.perform(get("/api/payments/summary?period=TODAY")
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andReturn();
        long beforeCollected = objectMapper.readTree(sBefore.getResponse().getContentAsString())
                .path("data").path("collectedPaise").asLong();

        MvcResult dBefore = mockMvc.perform(get("/api/dashboard")
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andReturn();
        long beforeTodayCol = objectMapper.readTree(dBefore.getResponse().getContentAsString())
                .path("data").path("todayCollection").asLong();

        // Create member and make payment
        CreateMemberRequest req = new CreateMemberRequest();
        req.setName("Cache Test Member");
        req.setPhone("9888812345");
        req.setPlanId(gymA_PlanId);

        MvcResult mRes = mockMvc.perform(post("/api/members")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode mData = objectMapper.readTree(mRes.getResponse().getContentAsString()).path("data");
        String mId = mData.path("id").asText();
        String memId = mData.path("currentMembership").path("id").asText();

        CreatePaymentRequest pay = new CreatePaymentRequest();
        pay.setMemberId(mId);
        pay.setMembershipId(memId);
        pay.setAmountPaise(150000L);
        pay.setMode("UPI");

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pay)))
                .andExpect(status().isOk());

        // Immediately check summary and dashboard without waiting 30 seconds
        MvcResult sAfter = mockMvc.perform(get("/api/payments/summary?period=TODAY")
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andReturn();
        long afterCollected = objectMapper.readTree(sAfter.getResponse().getContentAsString())
                .path("data").path("collectedPaise").asLong();
        assertEquals(beforeCollected + 150000L, afterCollected,
                "Summary must reflect payment immediately due to cache eviction");

        MvcResult dAfter = mockMvc.perform(get("/api/dashboard")
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andReturn();
        long afterTodayCol = objectMapper.readTree(dAfter.getResponse().getContentAsString())
                .path("data").path("todayCollection").asLong();
        assertEquals(beforeTodayCol + 150000L, afterTodayCol,
                "Dashboard must reflect payment immediately due to cache eviction");
    }

    @Test
    void testTenantIsolationGymACannotReadGymB() throws Exception {
        // Create member and payment in Gym B
        PlanRequest planReqB = new PlanRequest();
        planReqB.setName("Gym B Monthly");
        planReqB.setDurationDays(30);
        planReqB.setPricePaise(300000L);

        MvcResult pRes = mockMvc.perform(post("/api/plans")
                        .header("Authorization", gymB_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(planReqB)))
                .andExpect(status().isCreated())
                .andReturn();
        String planBId = objectMapper.readTree(pRes.getResponse().getContentAsString()).path("data").path("id").asText();

        CreateMemberRequest mReqB = new CreateMemberRequest();
        mReqB.setName("Gym B Member");
        mReqB.setPhone("9777777777");
        mReqB.setPlanId(planBId);

        MvcResult mResB = mockMvc.perform(post("/api/members")
                        .header("Authorization", gymB_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mReqB)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode mDataB = objectMapper.readTree(mResB.getResponse().getContentAsString()).path("data");
        String mIdB = mDataB.path("id").asText();
        String memIdB = mDataB.path("currentMembership").path("id").asText();

        CreatePaymentRequest payB = new CreatePaymentRequest();
        payB.setMemberId(mIdB);
        payB.setMembershipId(memIdB);
        payB.setAmountPaise(100000L);
        payB.setMode("CASH");

        MvcResult payBRes = mockMvc.perform(post("/api/payments")
                        .header("Authorization", gymB_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payB)))
                .andExpect(status().isOk())
                .andReturn();
        String paymentBId = objectMapper.readTree(payBRes.getResponse().getContentAsString()).path("data").path("id").asText();

        // 1. Gym A owner tries to read Gym B payment detail -> 404
        mockMvc.perform(get("/api/payments/" + paymentBId)
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isNotFound());

        // 2. Gym A payments list must NOT contain Gym B payment
        mockMvc.perform(get("/api/payments")
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.payments.content[*].id", not(hasItem(paymentBId))));

        // 3. Gym A dues list must NOT contain Gym B membership
        mockMvc.perform(get("/api/dues")
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[*].membershipId", not(hasItem(memIdB))));
    }

    @Test
    void testStaffPermissionsAndPhoneMasking() throws Exception {
        // 1. Create a member
        CreateMemberRequest mReq = new CreateMemberRequest();
        mReq.setName("Suresh Raina");
        mReq.setPhone("9812345678");
        mReq.setPlanId(gymA_PlanId);

        MvcResult mRes = mockMvc.perform(post("/api/members")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mReq)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode mData = objectMapper.readTree(mRes.getResponse().getContentAsString()).path("data");
        String mId = mData.path("id").asText();
        String memId = mData.path("currentMembership").path("id").asText();

        // 2. Staff records payment P_staff
        CreatePaymentRequest payStaff = new CreatePaymentRequest();
        payStaff.setMemberId(mId);
        payStaff.setMembershipId(memId);
        payStaff.setAmountPaise(100000L);
        payStaff.setMode("CASH");

        MvcResult payStaffRes = mockMvc.perform(post("/api/payments")
                        .header("Authorization", gymA_StaffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payStaff)))
                .andExpect(status().isOk())
                .andReturn();
        String pStaffId = objectMapper.readTree(payStaffRes.getResponse().getContentAsString()).path("data").path("id").asText();

        // 3. Owner records payment P_owner
        CreatePaymentRequest payOwner = new CreatePaymentRequest();
        payOwner.setMemberId(mId);
        payOwner.setMembershipId(memId);
        payOwner.setAmountPaise(50000L);
        payOwner.setMode("UPI");

        MvcResult payOwnerRes = mockMvc.perform(post("/api/payments")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payOwner)))
                .andExpect(status().isOk())
                .andReturn();
        String pOwnerId = objectMapper.readTree(payOwnerRes.getResponse().getContentAsString()).path("data").path("id").asText();

        // 4. Staff sees ONLY P_staff, not P_owner
        mockMvc.perform(get("/api/payments")
                        .header("Authorization", gymA_StaffToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.payments.content[*].id", hasItem(pStaffId)))
                .andExpect(jsonPath("$.data.payments.content[*].id", not(hasItem(pOwnerId))));

        // 5. Staff accessing P_owner directly returns 404
        mockMvc.perform(get("/api/payments/" + pOwnerId)
                        .header("Authorization", gymA_StaffToken))
                .andExpect(status().isNotFound());

        // 6. Staff accessing P_staff directly returns 200
        mockMvc.perform(get("/api/payments/" + pStaffId)
                        .header("Authorization", gymA_StaffToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id", is(pStaffId)))
                .andExpect(jsonPath("$.data.collectedByName", is("Staff John")));

        // 7. Staff cannot access summary (OWNER only -> 403)
        mockMvc.perform(get("/api/payments/summary")
                        .header("Authorization", gymA_StaffToken))
                .andExpect(status().isForbidden());

        // 8. Staff reading dues must NEVER see full phone number (masked)
        MvcResult duesRes = mockMvc.perform(get("/api/dues")
                        .header("Authorization", gymA_StaffToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode duesJson = objectMapper.readTree(duesRes.getResponse().getContentAsString());
        JsonNode items = duesJson.path("data").path("items");
        assertTrue(items.size() > 0);
        for (JsonNode item : items) {
            String phone = item.path("phone").asText();
            assertTrue(phone.contains("X") || phone.contains("*"),
                    "Staff must see masked phone number, got: " + phone);
            assertFalse(phone.equals("9812345678"),
                    "Staff must never see full phone number: 9812345678");
        }

        // 9. Owner reading dues sees full phone number
        mockMvc.perform(get("/api/dues")
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[?(@.phone == '9812345678')]").exists());
    }

    @Test
    void testStaffSeesOnlyLast7DaysPayments() throws Exception {
        // Insert an older payment (10 days ago) collected by staff
        Payment oldPayment = Payment.builder()
                .gymId(gymA_Id)
                .memberId("dummy-m")
                .membershipId("dummy-mem")
                .memberName("Old Member")
                .amountPaise(100000L)
                .mode("CASH")
                .type("PAYMENT")
                .receiptNo("RCPT-OLD-01")
                .paidAt(LocalDateTime.now().minusDays(10))
                .receivedBy(gymA_StaffId)
                .build();
        oldPayment = paymentRepository.save(oldPayment);

        // Staff listing payments should NOT see this old payment
        mockMvc.perform(get("/api/payments")
                        .header("Authorization", gymA_StaffToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.payments.content[*].id", not(hasItem(oldPayment.getId()))));

        // Staff fetching old payment detail returns 404
        mockMvc.perform(get("/api/payments/" + oldPayment.getId())
                        .header("Authorization", gymA_StaffToken))
                .andExpect(status().isNotFound());

        // Owner CAN see old payment
        mockMvc.perform(get("/api/payments/" + oldPayment.getId())
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id", is(oldPayment.getId())));
    }

    @Test
    void testTrainerForbiddenOnAllPaymentsEndpoints() throws Exception {
        mockMvc.perform(get("/api/payments/summary")
                        .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/payments")
                        .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/payments/any-id")
                        .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        CreatePaymentRequest dummyPay = new CreatePaymentRequest();
        dummyPay.setMemberId("dummy");
        dummyPay.setMembershipId("dummy");
        dummyPay.setAmountPaise(100L);
        dummyPay.setMode("CASH");

        mockMvc.perform(post("/api/payments")
                        .header("Authorization", gymA_TrainerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dummyPay)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/payments/any-id/reverse")
                        .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/dues")
                        .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/payments/any-id/receipt")
                        .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void testPaymentDetailSummaryAndReversalLink() throws Exception {
        // Create member
        CreateMemberRequest mReq = new CreateMemberRequest();
        mReq.setName("Detail Check Member");
        mReq.setPhone("9899999999");
        mReq.setPlanId(gymA_PlanId);

        MvcResult mRes = mockMvc.perform(post("/api/members")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mReq)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode mData = objectMapper.readTree(mRes.getResponse().getContentAsString()).path("data");
        String mId = mData.path("id").asText();
        String memId = mData.path("currentMembership").path("id").asText();

        // Make payment
        CreatePaymentRequest pay = new CreatePaymentRequest();
        pay.setMemberId(mId);
        pay.setMembershipId(memId);
        pay.setAmountPaise(300000L);
        pay.setMode("UPI");
        pay.setReferenceNo("REF-12345");

        MvcResult payRes = mockMvc.perform(post("/api/payments")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pay)))
                .andExpect(status().isOk())
                .andReturn();
        String payId = objectMapper.readTree(payRes.getResponse().getContentAsString()).path("data").path("id").asText();

        // Get Detail before reversal
        mockMvc.perform(get("/api/payments/" + payId)
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id", is(payId)))
                .andExpect(jsonPath("$.data.referenceNo", is("REF-12345")))
                .andExpect(jsonPath("$.data.membershipSummary.totalPaise", is(500000)))
                .andExpect(jsonPath("$.data.membershipSummary.paidPaise", is(300000)))
                .andExpect(jsonPath("$.data.membershipSummary.duePaise", is(200000)))
                .andExpect(jsonPath("$.data.membershipSummary.status", is("ACTIVE")))
                .andExpect(jsonPath("$.data.reversedByPaymentId").doesNotExist());

        // Reverse the payment
        MvcResult revRes = mockMvc.perform(post("/api/payments/" + payId + "/reverse?notes=Accidental+charge")
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andReturn();
        String revId = objectMapper.readTree(revRes.getResponse().getContentAsString()).path("data").path("id").asText();

        // Check original payment detail now links to reversal
        mockMvc.perform(get("/api/payments/" + payId)
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reversedByPaymentId", is(revId)))
                .andExpect(jsonPath("$.data.reversalReceiptNo", notNullValue()));

        // Check reversal payment detail links back to original
        mockMvc.perform(get("/api/payments/" + revId)
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reversalOfId", is(payId)))
                .andExpect(jsonPath("$.data.amountPaise", is(-300000)));
    }

    @Test
    void testDuesFiltersAndSorting() throws Exception {
        // Register a fresh gym for isolated dues testing
        JsonNode dataDues = registerGymViaOtpToken(
                mockMvc, objectMapper,
                "Dues Isolated Gym", "Dues Owner", "9100000088", "duesowner@test.com"
        );
        String duesGymId = dataDues.path("user").path("gymId").asText();
        String duesOwnerToken = "Bearer " + dataDues.path("accessToken").asText();

        LocalDate today = LocalDate.now(PaymentService.KOLKATA_ZONE);

        // Member 1: OVERDUE (expiryDate in past, due > 0)
        Member mOverdue = Member.builder()
                .gymId(duesGymId)
                .name("Overdue Member")
                .phone("9911111111")
                .memberCode("GYMD-0101")
                .currentDuePaise(100000L)
                .currentExpiry(today.minusDays(5))
                .status("ACTIVE")
                .build();
        mOverdue = memberRepository.save(mOverdue);

        Membership memOverdue = Membership.builder()
                .gymId(duesGymId)
                .memberId(mOverdue.getId())
                .planName("Monthly")
                .totalPaise(200000L)
                .paidPaise(100000L)
                .duePaise(100000L)
                .startDate(today.minusDays(35))
                .expiryDate(today.minusDays(5))
                .status(Membership.MembershipStatus.ACTIVE)
                .build();
        memOverdue = membershipRepository.save(memOverdue);

        // Add matching payment for paidPaise = 100000 so invariants also hold
        Payment pOverdue = Payment.builder()
                .gymId(duesGymId)
                .memberId(mOverdue.getId())
                .membershipId(memOverdue.getId())
                .amountPaise(100000L)
                .mode("CASH")
                .type("PAYMENT")
                .receiptNo("RCPT-D-01")
                .paidAt(today.minusDays(35).atStartOfDay())
                .build();
        paymentRepository.save(pOverdue);

        // Member 2: EXPIRING (expiryDate in 3 days, due > 0)
        Member mExpiring = Member.builder()
                .gymId(duesGymId)
                .name("Expiring Member")
                .phone("9922222222")
                .memberCode("GYMD-0102")
                .currentDuePaise(200000L)
                .currentExpiry(today.plusDays(3))
                .status("ACTIVE")
                .build();
        mExpiring = memberRepository.save(mExpiring);

        Membership memExpiring = Membership.builder()
                .gymId(duesGymId)
                .memberId(mExpiring.getId())
                .planName("Monthly")
                .totalPaise(200000L)
                .paidPaise(0L)
                .duePaise(200000L)
                .startDate(today.minusDays(27))
                .expiryDate(today.plusDays(3))
                .status(Membership.MembershipStatus.ACTIVE)
                .build();
        membershipRepository.save(memExpiring);

        // Test Filter OVERDUE
        mockMvc.perform(get("/api/dues?filter=OVERDUE")
                        .header("Authorization", duesOwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[*].membershipId", hasItem(memOverdue.getId())))
                .andExpect(jsonPath("$.data.items[*].membershipId", not(hasItem(memExpiring.getId()))));

        // Test Filter EXPIRING
        mockMvc.perform(get("/api/dues?filter=EXPIRING")
                        .header("Authorization", duesOwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[*].membershipId", hasItem(memExpiring.getId())))
                .andExpect(jsonPath("$.data.items[*].membershipId", not(hasItem(memOverdue.getId()))));

        // Test Filter PARTIAL
        mockMvc.perform(get("/api/dues?filter=PARTIAL")
                        .header("Authorization", duesOwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[*].membershipId", hasItem(memOverdue.getId())));

        // Test Search by member code
        mockMvc.perform(get("/api/dues?search=GYMD-0101")
                        .header("Authorization", duesOwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()", is(1)))
                .andExpect(jsonPath("$.data.items[0].name", is("Overdue Member")));

        // Test sorting: due descending (200000 before 100000)
        mockMvc.perform(get("/api/dues")
                        .header("Authorization", duesOwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].duePaise", is(200000)))
                .andExpect(jsonPath("$.data.items[1].duePaise", is(100000)));
    }

    @Test
    void testControlledMoneyAdjustments() throws Exception {
        // Register dedicated Gym for Controlled Money Adjustments
        JsonNode adjData = registerGymViaOtpToken(
                mockMvc, objectMapper,
                "Adjustments Gym", "Adj Owner", "9100000071", "adj@moneytest.com"
        );
        String adjGymId = adjData.path("user").path("gymId").asText();
        String adjOwnerToken = "Bearer " + adjData.path("accessToken").asText();

        // Create Staff User in Adjustments Gym
        User adjStaff = User.builder()
                .gymId(adjGymId)
                .name("Adj Staff")
                .phone("9100000072")
                .role("STAFF")
                .active(true)
                .status("ACTIVE")
                .build();
        adjStaff = userRepository.save(adjStaff);
        String adjStaffToken = bearerTokenForUser(adjStaff.getId(), adjGymId, "STAFF");

        // Create Trainer User in Adjustments Gym
        User adjTrainer = User.builder()
                .gymId(adjGymId)
                .name("Adj Trainer")
                .phone("9100000073")
                .role("TRAINER")
                .active(true)
                .status("ACTIVE")
                .build();
        adjTrainer = userRepository.save(adjTrainer);
        String adjTrainerToken = bearerTokenForUser(adjTrainer.getId(), adjGymId, "TRAINER");

        // Create Plan for Adjustments Gym (price: 500000 paise = 5000 INR)
        PlanRequest planReq = new PlanRequest();
        planReq.setName("Adj Standard Plan");
        planReq.setDurationDays(30);
        planReq.setPricePaise(500000L);
        MvcResult planRes = mockMvc.perform(post("/api/plans")
                        .header("Authorization", adjOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(planReq)))
                .andExpect(status().isCreated())
                .andReturn();
        String adjPlanId = objectMapper.readTree(planRes.getResponse().getContentAsString()).path("data").path("id").asText();

        // Create Member
        CreateMemberRequest mReq = new CreateMemberRequest();
        mReq.setName("Discount Member");
        mReq.setPhone("9800000001");
        mReq.setPlanId(adjPlanId);

        MvcResult mRes = mockMvc.perform(post("/api/members")
                        .header("Authorization", adjOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(mReq)))
                .andExpect(status().isOk())
                .andReturn();
        String memberId = objectMapper.readTree(mRes.getResponse().getContentAsString()).path("data").path("id").asText();
        String membershipId = objectMapper.readTree(mRes.getResponse().getContentAsString()).path("data").path("currentMembership").path("id").asText();

        // 1. Discount larger than current due rejected (due is 500000L)
        ApplyDiscountRequest overDiscount = new ApplyDiscountRequest();
        overDiscount.setDiscountPaise(600000L);
        overDiscount.setReason("Excessive discount request");
        mockMvc.perform(post("/api/memberships/" + membershipId + "/discount")
                        .header("Authorization", adjOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overDiscount)))
                .andExpect(status().isBadRequest());

        // Reason too short (< 5 chars) rejected
        ApplyDiscountRequest shortReason = new ApplyDiscountRequest();
        shortReason.setDiscountPaise(100000L);
        shortReason.setReason("bad");
        mockMvc.perform(post("/api/memberships/" + membershipId + "/discount")
                        .header("Authorization", adjOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(shortReason)))
                .andExpect(status().isBadRequest());

        // STAFF cannot discount (403)
        ApplyDiscountRequest validDiscount = new ApplyDiscountRequest();
        validDiscount.setDiscountPaise(100000L);
        validDiscount.setReason("Valid promotional discount");
        mockMvc.perform(post("/api/memberships/" + membershipId + "/discount")
                        .header("Authorization", adjStaffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validDiscount)))
                .andExpect(status().isForbidden());

        // TRAINER cannot discount (403)
        mockMvc.perform(post("/api/memberships/" + membershipId + "/discount")
                        .header("Authorization", adjTrainerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validDiscount)))
                .andExpect(status().isForbidden());

        // OWNER applies valid discount (200) -> due becomes 400000L
        mockMvc.perform(post("/api/memberships/" + membershipId + "/discount")
                        .header("Authorization", adjOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validDiscount)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.discountPaise", is(100000)))
                .andExpect(jsonPath("$.data.duePaise", is(400000)));

        // Verify denormalized member due updated
        mockMvc.perform(get("/api/members/" + memberId)
                        .header("Authorization", adjOwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.currentDuePaise", is(400000)));

        // Invariants pass with discount
        assertFinancialInvariants(adjGymId);

        // 2. Payment ReferenceNo and Backdating Rules
        LocalDate todayKolkata = LocalDate.now(PaymentService.KOLKATA_ZONE);

        // Future date rejected (400)
        CreatePaymentRequest futurePay = new CreatePaymentRequest();
        futurePay.setMemberId(memberId);
        futurePay.setMembershipId(membershipId);
        futurePay.setAmountPaise(50000L);
        futurePay.setMode("UPI");
        futurePay.setReceivedAt(todayKolkata.plusDays(1));
        mockMvc.perform(post("/api/payments")
                        .header("Authorization", adjOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(futurePay)))
                .andExpect(status().isBadRequest());

        // STAFF cannot backdate (403)
        CreatePaymentRequest staffBackdate = new CreatePaymentRequest();
        staffBackdate.setMemberId(memberId);
        staffBackdate.setMembershipId(membershipId);
        staffBackdate.setAmountPaise(50000L);
        staffBackdate.setMode("UPI");
        staffBackdate.setReceivedAt(todayKolkata.minusDays(5));
        mockMvc.perform(post("/api/payments")
                        .header("Authorization", adjStaffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(staffBackdate)))
                .andExpect(status().isForbidden());

        // OWNER backdating > 31 days rejected (400)
        CreatePaymentRequest oldBackdate = new CreatePaymentRequest();
        oldBackdate.setMemberId(memberId);
        oldBackdate.setMembershipId(membershipId);
        oldBackdate.setAmountPaise(50000L);
        oldBackdate.setMode("UPI");
        oldBackdate.setReceivedAt(todayKolkata.minusDays(32));
        mockMvc.perform(post("/api/payments")
                        .header("Authorization", adjOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(oldBackdate)))
                .andExpect(status().isBadRequest());

        // ReferenceNo > 40 chars rejected (400)
        CreatePaymentRequest longRefPay = new CreatePaymentRequest();
        longRefPay.setMemberId(memberId);
        longRefPay.setMembershipId(membershipId);
        longRefPay.setAmountPaise(50000L);
        longRefPay.setMode("UPI");
        longRefPay.setReferenceNo("12345678901234567890123456789012345678901"); // 41 chars
        mockMvc.perform(post("/api/payments")
                        .header("Authorization", adjOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(longRefPay)))
                .andExpect(status().isBadRequest());

        // OWNER backdated <= 31 days accepted (200)
        CreatePaymentRequest validBackdate = new CreatePaymentRequest();
        validBackdate.setMemberId(memberId);
        validBackdate.setMembershipId(membershipId);
        validBackdate.setAmountPaise(100000L);
        validBackdate.setMode("UPI");
        validBackdate.setReferenceNo("UPI-TXN-VALID-123");
        validBackdate.setReceivedAt(todayKolkata.minusDays(10));

        MvcResult backdatePayRes = mockMvc.perform(post("/api/payments")
                        .header("Authorization", adjOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validBackdate)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.referenceNo", is("UPI-TXN-VALID-123")))
                .andReturn();
        String backdatedPaymentId = objectMapper.readTree(backdatePayRes.getResponse().getContentAsString()).path("data").path("id").asText();

        assertFinancialInvariants(adjGymId);

        // 3. Reversal Rules
        // STAFF cannot reverse (403)
        ReversePaymentRequest revReq = new ReversePaymentRequest();
        revReq.setReasonCode(ReversalReasonCode.WRONG_ENTRY);
        revReq.setNote("Customer entered wrong amount");

        mockMvc.perform(post("/api/payments/" + backdatedPaymentId + "/reverse")
                        .header("Authorization", adjStaffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(revReq)))
                .andExpect(status().isForbidden());

        // TRAINER cannot reverse (403)
        mockMvc.perform(post("/api/payments/" + backdatedPaymentId + "/reverse")
                        .header("Authorization", adjTrainerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(revReq)))
                .andExpect(status().isForbidden());

        // Reversal note < 5 chars rejected (400)
        ReversePaymentRequest shortNoteRev = new ReversePaymentRequest();
        shortNoteRev.setReasonCode(ReversalReasonCode.DUPLICATE);
        shortNoteRev.setNote("nope");
        mockMvc.perform(post("/api/payments/" + backdatedPaymentId + "/reverse")
                        .header("Authorization", adjOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(shortNoteRev)))
                .andExpect(status().isBadRequest());

        // OWNER reverses successfully (200)
        MvcResult revSuccessRes = mockMvc.perform(post("/api/payments/" + backdatedPaymentId + "/reverse")
                        .header("Authorization", adjOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(revReq)))
                .andExpect(status().isOk())
                .andReturn();
        String reversalPaymentId = objectMapper.readTree(revSuccessRes.getResponse().getContentAsString()).path("data").path("id").asText();

        // Invariants pass after reversal
        assertFinancialInvariants(adjGymId);

        // Double reversal rejected (400)
        mockMvc.perform(post("/api/payments/" + backdatedPaymentId + "/reverse")
                        .header("Authorization", adjOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(revReq)))
                .andExpect(status().isBadRequest());

        // Reversing a reversal rejected (400)
        mockMvc.perform(post("/api/payments/" + reversalPaymentId + "/reverse")
                        .header("Authorization", adjOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(revReq)))
                .andExpect(status().isBadRequest());

        // 4. Promised Date Rules
        // TRAINER cannot set promised date (403)
        UpdatePromisedDateRequest pDateReq = new UpdatePromisedDateRequest();
        pDateReq.setPromisedDate(todayKolkata.plusDays(15));
        mockMvc.perform(patch("/api/memberships/" + membershipId + "/promised-date")
                        .header("Authorization", adjTrainerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pDateReq)))
                .andExpect(status().isForbidden());

        // Promised date today or in past rejected (400)
        UpdatePromisedDateRequest pastPDate = new UpdatePromisedDateRequest();
        pastPDate.setPromisedDate(todayKolkata);
        mockMvc.perform(patch("/api/memberships/" + membershipId + "/promised-date")
                        .header("Authorization", adjStaffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pastPDate)))
                .andExpect(status().isBadRequest());

        // Promised date > 90 days rejected (400)
        UpdatePromisedDateRequest farPDate = new UpdatePromisedDateRequest();
        farPDate.setPromisedDate(todayKolkata.plusDays(91));
        mockMvc.perform(patch("/api/memberships/" + membershipId + "/promised-date")
                        .header("Authorization", adjStaffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(farPDate)))
                .andExpect(status().isBadRequest());

        // Valid future date <= 90 days accepted by STAFF (200)
        mockMvc.perform(patch("/api/memberships/" + membershipId + "/promised-date")
                        .header("Authorization", adjStaffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pDateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.promisedDate", is(todayKolkata.plusDays(15).toString())));

        // GET /api/dues shows promisedDate and promiseBroken = false
        mockMvc.perform(get("/api/dues")
                        .header("Authorization", adjOwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].promisedDate", is(todayKolkata.plusDays(15).toString())))
                .andExpect(jsonPath("$.data.items[0].promiseBroken", is(false)));

        // Directly update promisedDate in past to test promiseBroken = true
        Membership memEntity = membershipRepository.findById(membershipId).orElseThrow();
        memEntity.setPromisedDate(todayKolkata.minusDays(2));
        membershipRepository.save(memEntity);

        mockMvc.perform(get("/api/dues")
                        .header("Authorization", adjOwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].promiseBroken", is(true)));

        // 5. Tenant Isolation Across Gyms (404)
        // Gym A Owner cannot discount Gym Adj's membership
        mockMvc.perform(post("/api/memberships/" + membershipId + "/discount")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validDiscount)))
                .andExpect(status().isNotFound());

        // Gym A Owner cannot set promised date on Gym Adj's membership
        mockMvc.perform(patch("/api/memberships/" + membershipId + "/promised-date")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pDateReq)))
                .andExpect(status().isNotFound());

        // Gym A Owner cannot reverse Gym Adj's payment
        mockMvc.perform(post("/api/payments/" + backdatedPaymentId + "/reverse")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(revReq)))
                .andExpect(status().isNotFound());

        // 6. Audit Privacy Verification: No phone numbers and no names in audit logs
        List<AuditLog> auditLogs = auditLogRepository.findAll().stream()
                .filter(a -> adjGymId.equals(a.getGymId()))
                .toList();

        assertFalse(auditLogs.isEmpty(), "Audit logs should not be empty");

        boolean hasDiscountAudit = false;
        boolean hasBackdateAudit = false;
        boolean hasReversalAudit = false;

        for (AuditLog log : auditLogs) {
            if ("DISCOUNT_APPLIED".equals(log.getAction())) hasDiscountAudit = true;
            if ("PAYMENT_BACKDATED".equals(log.getAction())) hasBackdateAudit = true;
            if ("PAYMENT_REVERSED".equals(log.getAction())) hasReversalAudit = true;

            // Details must never contain member phone or name
            if (log.getDetails() != null) {
                assertFalse(log.getDetails().contains("9800000001"), "Audit details must not contain phone number");
                assertFalse(log.getDetails().contains("Discount Member"), "Audit details must not contain member name");
            }
        }

        assertTrue(hasDiscountAudit, "DISCOUNT_APPLIED audit log should exist");
        assertTrue(hasBackdateAudit, "PAYMENT_BACKDATED audit log should exist");
        assertTrue(hasReversalAudit, "PAYMENT_REVERSED audit log should exist");
    }

    @Test
    void testCollectionInfo_ReceiptPdf_And_DayClose() throws Exception {
        // ─────────────────────────────────────────────────────────────────────
        // 1. Gym Collection Info (UPI ID and UPI Name)
        // ─────────────────────────────────────────────────────────────────────
        // OWNER can get initial collection info (nulls)
        mockMvc.perform(get("/api/gym/collection-info")
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        // STAFF can get collection info
        mockMvc.perform(get("/api/gym/collection-info")
                        .header("Authorization", gymA_StaffToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        // TRAINER is forbidden (403)
        mockMvc.perform(get("/api/gym/collection-info")
                        .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        // Validate invalid UPI ID format rejected (400)
        String invalidUpiReq = """
                {
                    "upiId": "invalid-upi-format",
                    "upiName": "Gym Fitness UPI"
                }
                """;
        mockMvc.perform(put("/api/gym/collection-info")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidUpiReq))
                .andExpect(status().isBadRequest());

        // STAFF cannot update collection info (403)
        String validUpiReq = """
                {
                    "upiId": "gymfitness@okhdfcbank",
                    "upiName": "Gym A Fitness Collections"
                }
                """;
        mockMvc.perform(put("/api/gym/collection-info")
                        .header("Authorization", gymA_StaffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validUpiReq))
                .andExpect(status().isForbidden());

        // OWNER successfully updates collection info
        mockMvc.perform(put("/api/gym/collection-info")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validUpiReq))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.upiId", is("gymfitness@okhdfcbank")))
                .andExpect(jsonPath("$.data.upiName", is("Gym A Fitness Collections")));

        // Verify updated via GET
        mockMvc.perform(get("/api/gym/collection-info")
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.upiId", is("gymfitness@okhdfcbank")))
                .andExpect(jsonPath("$.data.upiName", is("Gym A Fitness Collections")));

        // Tenant Isolation: Gym B Owner cannot see Gym A's collection info
        mockMvc.perform(get("/api/gym/collection-info")
                        .header("Authorization", gymB_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.upiId").doesNotExist());

        // Configure Gym A with address, phone, GSTIN legal ID for full PDF verification
        Gym gymA = gymRepository.findById(gymA_Id).orElseThrow();
        gymA.setPhone("9876543210");
        gymA.setAddress(GymAddress.builder()
                .line1("123 Fitness Street")
                .line2("Near Metro")
                .district("Bengaluru")
                .state("Karnataka")
                .pincode("560001")
                .build());
        gymA.setLegalIdType(LegalIdType.GSTIN);
        gymA.setLegalIdNumber("29AAAAA0000A1Z5");
        gymRepository.save(gymA);

        // ─────────────────────────────────────────────────────────────────────
        // 2. Receipt PDF Generation & Content Verification
        // ─────────────────────────────────────────────────────────────────────
        // Create member in Gym A
        CreateMemberRequest memberReq = new CreateMemberRequest();
        memberReq.setName("Receipt Test Member");
        memberReq.setPhone("9844455566");
        memberReq.setPlanId(gymA_PlanId);

        MvcResult memberRes = mockMvc.perform(post("/api/members")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(memberReq)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode memberNode = objectMapper.readTree(memberRes.getResponse().getContentAsString()).path("data");
        String memberId = memberNode.path("id").asText();
        String membershipId = memberNode.path("currentMembership").path("id").asText();

        // Create initial payment for member
        CreatePaymentRequest payReq = new CreatePaymentRequest();
        payReq.setMemberId(memberId);
        payReq.setMembershipId(membershipId);
        payReq.setAmountPaise(250000L); // 2500 paid
        payReq.setMode("UPI");
        payReq.setReferenceNo("UPI-REC-1001");

        MvcResult initialPayRes = mockMvc.perform(post("/api/payments")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payReq)))
                .andExpect(status().isOk())
                .andReturn();

        Payment initialPayment = paymentRepository.findById(
                objectMapper.readTree(initialPayRes.getResponse().getContentAsString()).path("data").path("id").asText()
        ).orElseThrow();
        String paymentId = initialPayment.getId();

        // OWNER gets receipt PDF
        MvcResult pdfResOwner = mockMvc.perform(get("/api/payments/" + paymentId + "/receipt")
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andReturn();

        byte[] pdfBytesOwner = pdfResOwner.getResponse().getContentAsByteArray();
        assertTrue(pdfBytesOwner.length > 500, "Receipt PDF should have substantial byte content");

        // Parse PDF text with OpenPDF's PdfTextExtractor
        PdfReader readerOwner = new PdfReader(pdfBytesOwner);
        PdfTextExtractor extractorOwner = new PdfTextExtractor(readerOwner);
        String pdfTextOwner = extractorOwner.getTextFromPage(1);

        // Verify PDF Contents
        assertTrue(pdfTextOwner.contains("PAYMENT RECEIPT"), "PDF should have PAYMENT RECEIPT title");
        assertTrue(pdfTextOwner.contains(gymA.getName()), "PDF should have gym name");
        assertTrue(pdfTextOwner.contains("123 Fitness Street"), "PDF should have gym address");
        assertTrue(pdfTextOwner.contains("Phone: 9876543210"), "PDF for OWNER should include gym phone");
        assertTrue(pdfTextOwner.contains("GSTIN: 29AAAAA0000A1Z5"), "PDF should print GSTIN");
        assertFalse(pdfTextOwner.contains("Tax Invoice"), "PDF must NOT claim to be a tax invoice");
        assertTrue(pdfTextOwner.contains("This is a payment receipt, not a tax invoice"), "PDF must have exact footer");

        assertTrue(pdfTextOwner.contains(initialPayment.getReceiptNo()), "PDF must contain receipt number");
        assertTrue(pdfTextOwner.contains("Receipt Test Member"), "PDF must contain member name");
        assertFalse(pdfTextOwner.contains("9844455566"), "PDF must NOT contain member phone number!");
        assertTrue(pdfTextOwner.contains("Quarterly Plan"), "PDF must contain plan name");

        // Indian Currency figures and words
        // 2,500.00
        assertTrue(pdfTextOwner.contains("2,500.00"), "PDF must format amount with Indian currency digits");
        assertTrue(pdfTextOwner.contains("Two Thousand Five Hundred Rupees"), "PDF must format amount in words");

        // STAFF gets receipt PDF -> verify gym phone is NOT shown
        MvcResult pdfResStaff = mockMvc.perform(get("/api/payments/" + paymentId + "/receipt")
                        .header("Authorization", gymA_StaffToken))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andReturn();

        byte[] pdfBytesStaff = pdfResStaff.getResponse().getContentAsByteArray();
        PdfReader readerStaff = new PdfReader(pdfBytesStaff);
        String pdfTextStaff = new PdfTextExtractor(readerStaff).getTextFromPage(1);
        assertFalse(pdfTextStaff.contains("Phone: 9876543210"), "Staff view must NOT include gym phone");

        // TRAINER cannot download receipt (403)
        mockMvc.perform(get("/api/payments/" + paymentId + "/receipt")
                        .header("Authorization", gymA_TrainerToken))
                .andExpect(status().isForbidden());

        // Cross-gym isolation (404)
        mockMvc.perform(get("/api/payments/" + paymentId + "/receipt")
                        .header("Authorization", gymB_OwnerToken))
                .andExpect(status().isNotFound());

        // Reversal Receipt Verification
        ReversePaymentRequest revReq = new ReversePaymentRequest();
        revReq.setReasonCode(ReversalReasonCode.REFUND);
        revReq.setNote("Customer requested refund for membership");

        MvcResult revRes = mockMvc.perform(post("/api/payments/" + paymentId + "/reverse")
                        .header("Authorization", gymA_OwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(revReq)))
                .andExpect(status().isOk())
                .andReturn();

        String reversalPaymentId = objectMapper.readTree(revRes.getResponse().getContentAsString())
                .path("data").path("id").asText();

        MvcResult revPdfRes = mockMvc.perform(get("/api/payments/" + reversalPaymentId + "/receipt")
                        .header("Authorization", gymA_OwnerToken))
                .andExpect(status().isOk())
                .andReturn();

        PdfReader revReader = new PdfReader(revPdfRes.getResponse().getContentAsByteArray());
        String revPdfText = new PdfTextExtractor(revReader).getTextFromPage(1);
        assertTrue(revPdfText.contains("REVERSAL RECEIPT"), "Reversal receipt should print REVERSAL RECEIPT");
        assertTrue(revPdfText.contains("Original Receipt No: " + initialPayment.getReceiptNo()), "Reversal receipt should reference original");

        // ─────────────────────────────────────────────────────────────────────
        // 3. Day-Close Report & Submission (GET /api/payments/day-close, POST)
        // ─────────────────────────────────────────────────────────────────────
        // Create an isolated gym for day close test to have exact numbers
        JsonNode dcData = registerGymViaOtpToken(
                mockMvc, objectMapper,
                "Day Close Gym", "DC Owner", "9100000099", "dcowner@test.com"
        );
        String dcGymId = dcData.path("user").path("gymId").asText();
        String dcOwnerToken = "Bearer " + dcData.path("accessToken").asText();

        // Staff user in DC Gym
        User dcStaff = User.builder()
                .gymId(dcGymId)
                .name("Alex Staff")
                .phone("9100000098")
                .role("STAFF")
                .active(true)
                .status("ACTIVE")
                .build();
        dcStaff = userRepository.save(dcStaff);
        String dcStaffToken = bearerTokenForUser(dcStaff.getId(), dcGymId, "STAFF");

        // Create plan in DC Gym
        PlanRequest dcPlan = new PlanRequest();
        dcPlan.setName("Monthly Plan");
        dcPlan.setDurationDays(30);
        dcPlan.setPricePaise(300000L); // 3000

        MvcResult dcPlanRes = mockMvc.perform(post("/api/plans")
                        .header("Authorization", dcOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dcPlan)))
                .andExpect(status().isCreated())
                .andReturn();
        String dcPlanId = objectMapper.readTree(dcPlanRes.getResponse().getContentAsString())
                .path("data").path("id").asText();

        // Create Member 1 -> pay 1000 cash collected by Owner
        CreateMemberRequest m1Req = new CreateMemberRequest();
        m1Req.setName("M1 Cash");
        m1Req.setPhone("9811111111");
        m1Req.setPlanId(dcPlanId);

        MvcResult m1Res = mockMvc.perform(post("/api/members")
                        .header("Authorization", dcOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(m1Req)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode m1Node = objectMapper.readTree(m1Res.getResponse().getContentAsString()).path("data");

        CreatePaymentRequest p1 = new CreatePaymentRequest();
        p1.setMemberId(m1Node.path("id").asText());
        p1.setMembershipId(m1Node.path("currentMembership").path("id").asText());
        p1.setAmountPaise(100000L); // 1000 cash
        p1.setMode("CASH");
        mockMvc.perform(post("/api/payments")
                        .header("Authorization", dcOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(p1)))
                .andExpect(status().isOk());

        // Create Member 2 -> pay 1500 UPI collected by Staff
        CreateMemberRequest m2Req = new CreateMemberRequest();
        m2Req.setName("M2 UPI");
        m2Req.setPhone("9822222222");
        m2Req.setPlanId(dcPlanId);

        MvcResult m2Res = mockMvc.perform(post("/api/members")
                        .header("Authorization", dcOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(m2Req)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode m2Node = objectMapper.readTree(m2Res.getResponse().getContentAsString()).path("data");

        CreatePaymentRequest p2 = new CreatePaymentRequest();
        p2.setMemberId(m2Node.path("id").asText());
        p2.setMembershipId(m2Node.path("currentMembership").path("id").asText());
        p2.setAmountPaise(150000L); // 1500 UPI
        p2.setMode("UPI");
        mockMvc.perform(post("/api/payments")
                        .header("Authorization", dcStaffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(p2)))
                .andExpect(status().isOk());

        // Create Member 3 -> pay 2000 cash collected by Staff
        CreateMemberRequest m3Req = new CreateMemberRequest();
        m3Req.setName("M3 Cash Staff");
        m3Req.setPhone("9833333333");
        m3Req.setPlanId(dcPlanId);

        MvcResult m3Res = mockMvc.perform(post("/api/members")
                        .header("Authorization", dcOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(m3Req)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode m3Node = objectMapper.readTree(m3Res.getResponse().getContentAsString()).path("data");

        CreatePaymentRequest p3 = new CreatePaymentRequest();
        p3.setMemberId(m3Node.path("id").asText());
        p3.setMembershipId(m3Node.path("currentMembership").path("id").asText());
        p3.setAmountPaise(200000L); // 2000 cash
        p3.setMode("CASH");
        mockMvc.perform(post("/api/payments")
                        .header("Authorization", dcStaffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(p3)))
                .andExpect(status().isOk());

        LocalDate today = LocalDate.now(PaymentService.KOLKATA_ZONE);

        // STAFF cannot view day close (403)
        mockMvc.perform(get("/api/payments/day-close?date=" + today)
                        .header("Authorization", dcStaffToken))
                .andExpect(status().isForbidden());

        // OWNER gets day-close report
        // Expected: Cash = 1000 + 2000 = 3000 (300000 paise)
        // UPI = 1500 (150000 paise)
        // totalCollected = 4500 (450000 paise)
        // expectedCashPaise = 300000
        mockMvc.perform(get("/api/payments/day-close?date=" + today)
                        .header("Authorization", dcOwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.expectedCashPaise", is(300000)))
                .andExpect(jsonPath("$.data.totalCollectedPaise", is(450000)))
                .andExpect(jsonPath("$.data.byMode.CASH", is(300000)))
                .andExpect(jsonPath("$.data.byMode.UPI", is(150000)))
                .andExpect(jsonPath("$.data.count", is(3)))
                .andExpect(jsonPath("$.data.reversalsCount", is(0)))
                .andExpect(jsonPath("$.data.closed", is(false)))
                .andExpect(jsonPath("$.data.staffBreakdown", hasSize(2)));

        // STAFF cannot submit day close (403)
        String dcSubmitReq = """
                {
                    "date": "%s",
                    "countedCashPaise": 300000,
                    "note": "Drawer cash verified"
                }
                """.formatted(today);

        mockMvc.perform(post("/api/payments/day-close")
                        .header("Authorization", dcStaffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(dcSubmitReq))
                .andExpect(status().isForbidden());

        // OWNER submits day close with slight variance (e.g. 50 rupees short: 295000 counted vs 300000 expected)
        String dcSubmitVarianceReq = """
                {
                    "date": "%s",
                    "countedCashPaise": 295000,
                    "note": "Cash short by 50 Rs"
                }
                """.formatted(today);

        mockMvc.perform(post("/api/payments/day-close")
                        .header("Authorization", dcOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(dcSubmitVarianceReq))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.expectedCashPaise", is(300000)))
                .andExpect(jsonPath("$.data.countedCashPaise", is(295000)))
                .andExpect(jsonPath("$.data.differencePaise", is(-5000)))
                .andExpect(jsonPath("$.data.note", is("Cash short by 50 Rs")));

        // Attempting to submit day close AGAIN for the same date must fail (400) - cannot edit after save
        mockMvc.perform(post("/api/payments/day-close")
                        .header("Authorization", dcOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(dcSubmitVarianceReq))
                .andExpect(status().isBadRequest());

        // Verify GET day-close now reflects isClosed=true
        mockMvc.perform(get("/api/payments/day-close?date=" + today)
                        .header("Authorization", dcOwnerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.closed", is(true)))
                .andExpect(jsonPath("$.data.dayClose.differencePaise", is(-5000)));

        // Verify Audit Log has DAY_CLOSED
        List<AuditLog> dcAudits = auditLogRepository.findAll().stream()
                .filter(a -> dcGymId.equals(a.getGymId()) && "DAY_CLOSED".equals(a.getAction()))
                .toList();
        assertFalse(dcAudits.isEmpty(), "DAY_CLOSED audit log must exist");
        assertTrue(dcAudits.get(0).getDetails().contains("expected=300000"), "Audit log should contain day close amounts");
    }
}
