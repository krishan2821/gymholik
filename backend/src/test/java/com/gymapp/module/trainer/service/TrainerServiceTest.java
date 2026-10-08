package com.gymapp.module.trainer.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.module.audit.service.AuditLogService;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.trainer.dto.ApproveTrainerRequest;
import com.gymapp.module.trainer.dto.TrainerResponse;
import com.gymapp.module.trainer.entity.TrainerType;
import com.gymapp.module.trainer.repository.TrainerAssignmentRepository;
import com.gymapp.module.trainer.repository.TrainerTypeRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TrainerService Unit Tests")
class TrainerServiceTest {

    @Mock UserRepository userRepository;
    @Mock TrainerTypeRepository trainerTypeRepository;
    @Mock TrainerAssignmentRepository trainerAssignmentRepository;
    @Mock TrainerAssignmentService trainerAssignmentService;
    @Mock AuditLogService auditLogService;

    @InjectMocks TrainerService trainerService;

    private static final String GYM_ID = "gym-test";
    private static final String TRAINER_ID = "trainer-1";

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
    @DisplayName("approveTrainer — approves pending trainer and sets trainerTypeIds")
    void testApproveTrainer_Success() {
        User pendingTrainer = User.builder()
                .id(TRAINER_ID)
                .gymId(GYM_ID)
                .name("John Trainer")
                .phone("9876543210")
                .role("TRAINER")
                .active(false)
                .status("PENDING_APPROVAL")
                .build();

        TrainerType type1 = TrainerType.builder().id("type-1").gymId(GYM_ID).name("CrossFit").active(true).build();

        when(userRepository.findByIdAndGymId(TRAINER_ID, GYM_ID)).thenReturn(Optional.of(pendingTrainer));
        when(trainerTypeRepository.findByGymIdAndIdIn(GYM_ID, List.of("type-1"))).thenReturn(List.of(type1));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(trainerAssignmentRepository.findByGymIdAndTrainerIdAndStatus(GYM_ID, TRAINER_ID, "ACTIVE"))
                .thenReturn(List.of());

        ApproveTrainerRequest req = new ApproveTrainerRequest();
        req.setTrainerTypeIds(List.of("type-1"));

        TrainerResponse res = trainerService.approveTrainer(TRAINER_ID, req);

        assertThat(res.isActive()).isTrue();
        assertThat(res.getStatus()).isEqualTo("ACTIVE");
        assertThat(pendingTrainer.getTrainerTypeIds()).containsExactly("type-1");
        verify(auditLogService).log(eq("APPROVE_TRAINER"), eq(TRAINER_ID), anyString());
    }

    @Test
    @DisplayName("approveTrainer — throws error if trainer type does not exist")
    void testApproveTrainer_InvalidType() {
        User pendingTrainer = User.builder()
                .id(TRAINER_ID)
                .gymId(GYM_ID)
                .role("TRAINER")
                .status("PENDING_APPROVAL")
                .build();

        when(userRepository.findByIdAndGymId(TRAINER_ID, GYM_ID)).thenReturn(Optional.of(pendingTrainer));
        when(trainerTypeRepository.findByGymIdAndIdIn(GYM_ID, List.of("invalid-type"))).thenReturn(List.of());

        ApproveTrainerRequest req = new ApproveTrainerRequest();
        req.setTrainerTypeIds(List.of("invalid-type"));

        assertThatThrownBy(() -> trainerService.approveTrainer(TRAINER_ID, req))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("trainer types are invalid");
    }

    @Test
    @DisplayName("rejectTrainer — rejects trainer and auto-ends active assignments")
    void testRejectTrainer_EndsAssignments() {
        User trainer = User.builder()
                .id(TRAINER_ID)
                .gymId(GYM_ID)
                .name("Alex")
                .role("TRAINER")
                .active(true)
                .status("ACTIVE")
                .build();

        when(userRepository.findByIdAndGymId(TRAINER_ID, GYM_ID)).thenReturn(Optional.of(trainer));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TrainerResponse res = trainerService.rejectTrainer(TRAINER_ID);

        assertThat(res.isActive()).isFalse();
        assertThat(res.getStatus()).isEqualTo("REJECTED");
        verify(trainerAssignmentService).endAllActiveAssignmentsForTrainer(eq(GYM_ID), eq(TRAINER_ID), any());
        verify(auditLogService).log(eq("REJECT_TRAINER"), eq(TRAINER_ID), anyString());
    }

    @Test
    @DisplayName("deactivateTrainer — deactivates trainer and auto-ends active assignments")
    void testDeactivateTrainer_EndsAssignments() {
        User trainer = User.builder()
                .id(TRAINER_ID)
                .gymId(GYM_ID)
                .name("Sam")
                .role("TRAINER")
                .active(true)
                .status("ACTIVE")
                .build();

        when(userRepository.findByIdAndGymId(TRAINER_ID, GYM_ID)).thenReturn(Optional.of(trainer));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TrainerResponse res = trainerService.deactivateTrainer(TRAINER_ID);

        assertThat(res.isActive()).isFalse();
        assertThat(res.getStatus()).isEqualTo("INACTIVE");
        verify(trainerAssignmentService).endAllActiveAssignmentsForTrainer(eq(GYM_ID), eq(TRAINER_ID), any());
        verify(auditLogService).log(eq("DEACTIVATE_TRAINER"), eq(TRAINER_ID), anyString());
    }

    @Test
    @DisplayName("non-owner calling TrainerService throws ACCESS_DENIED")
    void testNonOwner_ThrowsAccessDenied() {
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("trainer-1", null,
                java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_TRAINER")));
        auth.setDetails(new com.gymapp.security.JwtDetails("trainer-1", GYM_ID, "TRAINER"));
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        assertThatThrownBy(() -> trainerService.getTrainers(null))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Access denied");

        assertThatThrownBy(() -> trainerService.getTrainerById(TRAINER_ID))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Access denied");

        ApproveTrainerRequest req = new ApproveTrainerRequest();
        req.setTrainerTypeIds(java.util.List.of("t-1"));
        assertThatThrownBy(() -> trainerService.approveTrainer(TRAINER_ID, req))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Access denied");
    }
}
