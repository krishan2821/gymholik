package com.gymapp.module.member.service;

import com.gymapp.common.PagedResponse;
import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.member.dto.CreateMemberRequest;
import com.gymapp.module.member.dto.MemberResponse;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
import com.gymapp.module.plan.entity.Plan;
import com.gymapp.module.plan.repository.PlanRepository;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.bson.Document;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MemberServiceTest {

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private MembershipRepository membershipRepository;

    @Mock
    private PlanRepository planRepository;

    @Mock
    private MongoTemplate mongoTemplate;

    @Mock
    private SequenceService sequenceService;

    @Mock
    private com.gymapp.module.trainer.repository.TrainerAssignmentRepository trainerAssignmentRepository;

    @Mock
    private com.gymapp.module.trainer.service.TrainerAssignmentService trainerAssignmentService;

    @InjectMocks
    private MemberService memberService;

    private static final String GYM_ID = "gym123";
    private static final String MEMBER_ID = "mem123";
    private static final String PLAN_ID = "plan123";

    @BeforeEach
    void setUp() {
        TenantContext.setGymId(GYM_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void testCreateMember_Success() {
        CreateMemberRequest request = new CreateMemberRequest();
        request.setName("John Doe");
        request.setPhone("1234567890");
        request.setPlanId(PLAN_ID);

        Plan plan = new Plan();
        plan.setId(PLAN_ID);
        plan.setGymId(GYM_ID);
        plan.setDurationDays(30);
        plan.setPricePaise(1000L);

        when(memberRepository.existsByGymIdAndPhone(GYM_ID, request.getPhone())).thenReturn(false);
        when(planRepository.findByIdAndGymId(PLAN_ID, GYM_ID)).thenReturn(Optional.of(plan));
        when(sequenceService.generateNextMemberCode(GYM_ID)).thenReturn("GYM-0001");

        when(memberRepository.save(any(Member.class))).thenAnswer(i -> {
            Member m = i.getArgument(0);
            m.setId(MEMBER_ID);
            return m;
        });

        when(membershipRepository.save(any(Membership.class))).thenAnswer(i -> {
            Membership ms = i.getArgument(0);
            ms.setId("ms123");
            ms.setCreatedAt(LocalDateTime.now());
            return ms;
        });

        MemberResponse response = memberService.createMember(request);

        assertNotNull(response);
        assertEquals("John Doe", response.getName());
        assertEquals("GYM-0001", response.getMemberCode());
        assertNotNull(response.getCurrentMembership());
        assertEquals(PLAN_ID, response.getCurrentMembership().getPlanId());
        
        verify(memberRepository).save(any(Member.class));
        verify(membershipRepository).save(any(Membership.class));
    }

    @Test
    void testCreateMember_PhoneAlreadyExists() {
        CreateMemberRequest request = new CreateMemberRequest();
        request.setPhone("1234567890");

        when(memberRepository.existsByGymIdAndPhone(GYM_ID, request.getPhone())).thenReturn(true);

        AppException exception = assertThrows(AppException.class, () -> memberService.createMember(request));
        assertEquals(ErrorCode.MEMBER_PHONE_EXISTS, exception.getErrorCode());
        
        verify(memberRepository, never()).save(any(Member.class));
    }

    @Test
    void testGetMembers_Success() {
        Pageable pageable = PageRequest.of(0, 10);
        Member member = new Member();
        member.setId(MEMBER_ID);
        member.setGymId(GYM_ID);
        member.setName("Jane Doe");

        when(mongoTemplate.find(any(org.springframework.data.mongodb.core.query.Query.class), eq(Member.class)))
                .thenReturn(Collections.singletonList(member));
        when(mongoTemplate.count(any(org.springframework.data.mongodb.core.query.Query.class), eq(Member.class)))
                .thenReturn(1L);
        
        AggregationResults<Membership> emptyResults = new AggregationResults<>(Collections.emptyList(), new Document());
        when(mongoTemplate.aggregate(any(Aggregation.class), eq("memberships"), eq(Membership.class)))
                .thenReturn(emptyResults);

        PagedResponse<MemberResponse> response = memberService.getMembers(null, "All", pageable);

        assertNotNull(response);
        assertEquals(1, response.getContent().size());
        assertEquals("Jane Doe", response.getContent().get(0).getName());
    }

    @Test
    void testDeleteMember_Success() {
        Member member = new Member();
        member.setId(MEMBER_ID);
        member.setGymId(GYM_ID);
        member.setStatus("ACTIVE");

        Membership activeMembership = new Membership();
        activeMembership.setStatus(Membership.MembershipStatus.ACTIVE);

        when(memberRepository.findByIdAndGymId(MEMBER_ID, GYM_ID)).thenReturn(Optional.of(member));
        when(membershipRepository.findByGymIdAndMemberId(GYM_ID, MEMBER_ID))
                .thenReturn(Collections.singletonList(activeMembership));

        memberService.deleteMember(MEMBER_ID);

        assertEquals("INACTIVE", member.getStatus());
        assertEquals(Membership.MembershipStatus.EXPIRED, activeMembership.getStatus());

        verify(memberRepository).save(member);
        verify(membershipRepository).saveAll(any());
    }
}
