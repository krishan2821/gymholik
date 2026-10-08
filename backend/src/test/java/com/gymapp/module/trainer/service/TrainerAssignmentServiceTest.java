package com.gymapp.module.trainer.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.audit.service.AuditLogService;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.trainer.dto.AssignMembersRequest;
import com.gymapp.module.trainer.dto.AssignmentResponse;
import com.gymapp.module.trainer.dto.ReassignTrainerRequest;
import com.gymapp.module.trainer.entity.TrainerAssignment;
import com.gymapp.module.trainer.repository.TrainerAssignmentRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TrainerAssignmentService Unit Tests")
class TrainerAssignmentServiceTest {

    @Mock TrainerAssignmentRepository trainerAssignmentRepository;
    @Mock UserRepository userRepository;
    @Mock MemberRepository memberRepository;
    @Mock AuditLogService auditLogService;
    @Mock MongoTemplate mongoTemplate;

    @InjectMocks TrainerAssignmentService trainerAssignmentService;

    private static final String GYM_ID = "gym-test";
    private static final String TRAINER_ID = "trainer-1";
    private static final String MEMBER_ID = "member-1";

    @BeforeEach
    void setUp() {
        TenantContext.setGymId(GYM_ID);
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("owner-1", null,
                java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_OWNER")));
        auth.setDetails(new com.gymapp.security.JwtDetails("owner-1", GYM_ID, "OWNER"));
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("assignMembers — assigns member to active trainer")
    void testAssignMembers_Success() {
        User trainer = User.builder()
                .id(TRAINER_ID)
                .gymId(GYM_ID)
                .name("Trainer Bob")
                .role("TRAINER")
                .active(true)
                .status("ACTIVE")
                .build();

        Member member = Member.builder()
                .id(MEMBER_ID)
                .gymId(GYM_ID)
                .name("Alice")
                .status("ACTIVE")
                .build();

        when(userRepository.findByIdAndGymId(TRAINER_ID, GYM_ID)).thenReturn(Optional.of(trainer));
        when(memberRepository.findByIdAndGymId(MEMBER_ID, GYM_ID)).thenReturn(Optional.of(member));
        when(trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                GYM_ID, TRAINER_ID, MEMBER_ID, "ACTIVE")).thenReturn(false);
        when(trainerAssignmentRepository.save(any(TrainerAssignment.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AssignMembersRequest req = new AssignMembersRequest();
        req.setTrainerId(TRAINER_ID);
        req.setMemberIds(List.of(MEMBER_ID));

        List<AssignmentResponse> res = trainerAssignmentService.assignMembers(req);

        assertThat(res).hasSize(1);
        assertThat(res.get(0).getStatus()).isEqualTo("ACTIVE");
        verify(auditLogService).log(eq("ASSIGN_MEMBER"), any(), anyString());
    }

    @Test
    @DisplayName("assignMembers — throws error if member already has active assignment with trainer")
    void testAssignMembers_DuplicateFails() {
        User trainer = User.builder()
                .id(TRAINER_ID)
                .gymId(GYM_ID)
                .name("Trainer Bob")
                .role("TRAINER")
                .active(true)
                .status("ACTIVE")
                .build();

        Member member = Member.builder()
                .id(MEMBER_ID)
                .gymId(GYM_ID)
                .name("Alice")
                .status("ACTIVE")
                .build();

        when(userRepository.findByIdAndGymId(TRAINER_ID, GYM_ID)).thenReturn(Optional.of(trainer));
        when(memberRepository.findByIdAndGymId(MEMBER_ID, GYM_ID)).thenReturn(Optional.of(member));
        when(trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                GYM_ID, TRAINER_ID, MEMBER_ID, "ACTIVE")).thenReturn(true);

        AssignMembersRequest req = new AssignMembersRequest();
        req.setTrainerId(TRAINER_ID);
        req.setMemberIds(List.of(MEMBER_ID));

        assertThatThrownBy(() -> trainerAssignmentService.assignMembers(req))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("already has an active assignment");
    }

    @Test
    @DisplayName("endAssignment — sets status to ENDED and endDate to today")
    void testEndAssignment_Success() {
        TrainerAssignment assignment = TrainerAssignment.builder()
                .id("assignment-1")
                .gymId(GYM_ID)
                .trainerId(TRAINER_ID)
                .memberId(MEMBER_ID)
                .status("ACTIVE")
                .startDate(LocalDate.now().minusDays(10))
                .build();

        when(trainerAssignmentRepository.findByIdAndGymId("assignment-1", GYM_ID))
                .thenReturn(Optional.of(assignment));
        when(trainerAssignmentRepository.save(any(TrainerAssignment.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AssignmentResponse res = trainerAssignmentService.endAssignment("assignment-1");

        assertThat(res.getStatus()).isEqualTo("ENDED");
        assertThat(assignment.getEndDate()).isEqualTo(LocalDate.now());
        verify(auditLogService).log(eq("END_ASSIGNMENT"), eq("assignment-1"), anyString());
    }

    @Test
    @DisplayName("reassignAll — ends previous trainer assignments and assigns to target trainer")
    void testReassignAll_Success() {
        String toTrainerId = "trainer-2";

        User fromTrainer = User.builder().id(TRAINER_ID).gymId(GYM_ID).name("Old Trainer").role("TRAINER").build();
        User toTrainer = User.builder().id(toTrainerId).gymId(GYM_ID).name("New Trainer").role("TRAINER").active(true).status("ACTIVE").build();

        TrainerAssignment oldAssignment = TrainerAssignment.builder()
                .id("assign-1")
                .gymId(GYM_ID)
                .trainerId(TRAINER_ID)
                .memberId(MEMBER_ID)
                .status("ACTIVE")
                .startDate(LocalDate.now().minusDays(20))
                .build();

        when(userRepository.findByIdAndGymId(TRAINER_ID, GYM_ID)).thenReturn(Optional.of(fromTrainer));
        when(userRepository.findByIdAndGymId(toTrainerId, GYM_ID)).thenReturn(Optional.of(toTrainer));
        when(trainerAssignmentRepository.findByGymIdAndTrainerIdAndStatus(GYM_ID, TRAINER_ID, "ACTIVE"))
                .thenReturn(List.of(oldAssignment));
        when(trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                GYM_ID, toTrainerId, MEMBER_ID, "ACTIVE")).thenReturn(false);

        ReassignTrainerRequest req = new ReassignTrainerRequest();
        req.setFromTrainerId(TRAINER_ID);
        req.setToTrainerId(toTrainerId);
        req.setNotes("Reassigned for scheduling");

        trainerAssignmentService.reassignAll(req);

        assertThat(oldAssignment.getStatus()).isEqualTo("ENDED");
        assertThat(oldAssignment.getEndDate()).isEqualTo(LocalDate.now());
        verify(trainerAssignmentRepository).save(oldAssignment);
        verify(trainerAssignmentRepository).save(argThat(a ->
                toTrainerId.equals(a.getTrainerId()) && "ACTIVE".equals(a.getStatus())));
        verify(auditLogService).log(eq("REASSIGN_TRAINER"), eq(toTrainerId), anyString());
    }

    @Test
    @DisplayName("non-owner calling TrainerAssignmentService throws ACCESS_DENIED")
    void testNonOwner_ThrowsAccessDenied() {
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("trainer-1", null,
                java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_TRAINER")));
        auth.setDetails(new com.gymapp.security.JwtDetails("trainer-1", GYM_ID, "TRAINER"));
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        AssignMembersRequest req = new AssignMembersRequest();
        req.setTrainerId(TRAINER_ID);
        req.setMemberIds(java.util.List.of(MEMBER_ID));

        assertThatThrownBy(() -> trainerAssignmentService.assignMembers(req))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Access denied");

        assertThatThrownBy(() -> trainerAssignmentService.endAssignment("assign-1"))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Access denied");

        ReassignTrainerRequest reassignReq = new ReassignTrainerRequest();
        reassignReq.setFromTrainerId(TRAINER_ID);
        reassignReq.setToTrainerId("t-2");
        assertThatThrownBy(() -> trainerAssignmentService.reassignAll(reassignReq))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Access denied");

        assertThatThrownBy(() -> trainerAssignmentService.getAssignments(null, null, null,
                org.springframework.data.domain.PageRequest.of(0, 10)))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Access denied");
    }
}
