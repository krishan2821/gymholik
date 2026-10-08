package com.gymapp.module.payment.service;

import com.gymapp.common.TenantContext;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
import com.gymapp.module.member.service.SequenceService;
import com.gymapp.module.payment.dto.CreatePaymentRequest;
import com.gymapp.module.payment.entity.Payment;

import com.gymapp.module.payment.repository.PaymentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock private PaymentRepository paymentRepository;
    @Mock private MembershipRepository membershipRepository;
    @Mock private MemberRepository memberRepository;
    @Mock private SequenceService sequenceService;
    @Mock private MongoTemplate mongoTemplate;

    @InjectMocks
    private PaymentService paymentService;

    @BeforeEach
    void setUp() {
        TenantContext.setGymId("GYM123");
    }

    @Test
    void testCreatePaymentUsesAtomicUpdateToPreventRaceCondition() {
        // Arrange
        CreatePaymentRequest request = new CreatePaymentRequest();
        request.setMemberId("M1");
        request.setMembershipId("MEM1");
        request.setAmountPaise(5000L); // 50 rupees
        request.setMode("CASH");

        Member member = new Member();
        member.setId("M1");
        member.setGymId("GYM123");

        Membership membership = new Membership();
        membership.setId("MEM1");
        membership.setMemberId("M1");
        membership.setGymId("GYM123");
        membership.setDuePaise(10000L);

        when(memberRepository.findByIdAndGymId("M1", "GYM123")).thenReturn(Optional.of(member));
        when(membershipRepository.findByIdAndGymId("MEM1", "GYM123")).thenReturn(Optional.of(membership));
        when(sequenceService.generateNextReceiptNo("GYM123")).thenReturn("RCPT-001");
        when(paymentRepository.save(any(Payment.class))).thenAnswer(i -> i.getArgument(0));

        // Act
        paymentService.createPayment(request);

        // Assert
        ArgumentCaptor<Update> updateCaptor = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateFirst(any(Query.class), updateCaptor.capture(), eq(Membership.class));

        Update update = updateCaptor.getValue();
        // Since getUpdateObject() is protected or internal, we can just verify the method was called correctly
        // The mock will have captured the Update object which should have "$inc"
        assertEquals(true, update.getUpdateObject().containsKey("$inc"), "Update must use atomic $inc");
        
        org.bson.Document incDocument = (org.bson.Document) update.getUpdateObject().get("$inc");
        assertEquals(5000L, incDocument.get("paidPaise"));
        assertEquals(-5000L, incDocument.get("duePaise"));
    }
}
