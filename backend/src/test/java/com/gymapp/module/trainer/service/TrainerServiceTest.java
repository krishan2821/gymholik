package com.gymapp.module.trainer.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.audit.service.AuditLogService;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.RefreshTokenRepository;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.trainer.dto.CreateTrainerRequest;
import com.gymapp.module.trainer.dto.TrainerResponse;
import com.gymapp.module.trainer.dto.UpdateTrainerRequest;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("TrainerService Unit Tests")
class TrainerServiceTest {

    @Mock UserRepository userRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
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
    @DisplayName("createTrainer — creates ACTIVE trainer with gymId from TenantContext, assigns members, logs TRAINER_CREATED without phone")
    void testCreateTrainer_SuccessWithImmediateAssignment() {
        TrainerType type1 = TrainerType.builder().id("type-1").gymId(GYM_ID).name("CrossFit").active(true).build();
        when(userRepository.existsByPhone("9876543210")).thenReturn(false);
        when(trainerTypeRepository.findByGymIdAndIdIn(GYM_ID, List.of("type-1"))).thenReturn(List.of(type1));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(TRAINER_ID);
            return u;
        });
        when(trainerAssignmentRepository.findByGymIdAndTrainerIdAndStatus(GYM_ID, TRAINER_ID, "ACTIVE"))
                .thenReturn(List.of());

        CreateTrainerRequest req = CreateTrainerRequest.builder()
                .name("Coach Ray")
                .phone("+919876543210")
                .trainerTypeIds(List.of("type-1"))
                .memberIds(List.of("m-1", "m-2"))
                .build();

        TrainerResponse res = trainerService.createTrainer(req);

        assertThat(res.getId()).isEqualTo(TRAINER_ID);
        assertThat(res.getName()).isEqualTo("Coach Ray");
        assertThat(res.getPhone()).isEqualTo("9876543210");
        assertThat(res.getStatus()).isEqualTo("ACTIVE");
        assertThat(res.isActive()).isTrue();

        verify(trainerAssignmentService).assignMembers(argThat(a ->
                TRAINER_ID.equals(a.getTrainerId()) && a.getMemberIds().equals(List.of("m-1", "m-2"))));
        verify(auditLogService).log(eq("TRAINER_CREATED"), eq(TRAINER_ID),
                argThat(details -> !details.contains("9876543210")));
    }

    @Test
    @DisplayName("createTrainer — duplicate phone throws 409 PHONE_ALREADY_REGISTERED")
    void testCreateTrainer_DuplicatePhone() {
        when(userRepository.existsByPhone("9876543210")).thenReturn(true);

        CreateTrainerRequest req = CreateTrainerRequest.builder()
                .name("Coach Ray")
                .phone("9876543210")
                .trainerTypeIds(List.of("type-1"))
                .build();

        assertThatThrownBy(() -> trainerService.createTrainer(req))
                .isInstanceOf(AppException.class)
                .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                        .isEqualTo(ErrorCode.PHONE_ALREADY_REGISTERED));
    }

    @Test
    @DisplayName("updateTrainer — changing phone bumps tokenVersion, deletes refresh tokens, and logs TRAINER_PHONE_CHANGED without phone")
    void testUpdateTrainer_PhoneChangeBumpsTokenVersion() {
        User trainer = User.builder()
                .id(TRAINER_ID)
                .gymId(GYM_ID)
                .name("John Trainer")
                .phone("9876543210")
                .role("TRAINER")
                .active(true)
                .status("ACTIVE")
                .tokenVersion(2)
                .build();

        when(userRepository.findByIdAndGymId(TRAINER_ID, GYM_ID)).thenReturn(Optional.of(trainer));
        when(userRepository.existsByPhone("9876543299")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(trainerAssignmentRepository.findByGymIdAndTrainerIdAndStatus(GYM_ID, TRAINER_ID, "ACTIVE"))
                .thenReturn(List.of());

        UpdateTrainerRequest req = UpdateTrainerRequest.builder()
                .phone("9876543299")
                .build();

        TrainerResponse res = trainerService.updateTrainer(TRAINER_ID, req);

        assertThat(res.getPhone()).isEqualTo("9876543299");
        assertThat(trainer.getTokenVersion()).isEqualTo(3);
        verify(refreshTokenRepository).deleteByUserId(TRAINER_ID);
        verify(auditLogService).log(eq("TRAINER_PHONE_CHANGED"), eq(TRAINER_ID),
                argThat(details -> !details.contains("9876543210") && !details.contains("9876543299")));
    }

    @Test
    @DisplayName("updateTrainerTypes — updates trainerTypeIds for active trainer")
    void testUpdateTrainerTypes_Success() {
        User trainer = User.builder()
                .id(TRAINER_ID)
                .gymId(GYM_ID)
                .name("John Trainer")
                .phone("9876543210")
                .role("TRAINER")
                .active(true)
                .status("ACTIVE")
                .build();

        TrainerType type1 = TrainerType.builder().id("type-1").gymId(GYM_ID).name("CrossFit").active(true).build();

        when(userRepository.findByIdAndGymId(TRAINER_ID, GYM_ID)).thenReturn(Optional.of(trainer));
        when(trainerTypeRepository.findByGymIdAndIdIn(GYM_ID, List.of("type-1"))).thenReturn(List.of(type1));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(trainerAssignmentRepository.findByGymIdAndTrainerIdAndStatus(GYM_ID, TRAINER_ID, "ACTIVE"))
                .thenReturn(List.of());

        TrainerResponse res = trainerService.updateTrainerTypes(TRAINER_ID, List.of("type-1"));

        assertThat(res.isActive()).isTrue();
        assertThat(res.getStatus()).isEqualTo("ACTIVE");
        assertThat(trainer.getTrainerTypeIds()).containsExactly("type-1");
        verify(auditLogService).log(eq("TRAINER_UPDATED"), eq(TRAINER_ID), anyString());
    }

    @Test
    @DisplayName("updateTrainerTypes — throws error if trainer type does not exist")
    void testUpdateTrainerTypes_InvalidType() {
        User trainer = User.builder()
                .id(TRAINER_ID)
                .gymId(GYM_ID)
                .role("TRAINER")
                .active(true)
                .status("ACTIVE")
                .build();

        when(userRepository.findByIdAndGymId(TRAINER_ID, GYM_ID)).thenReturn(Optional.of(trainer));
        when(trainerTypeRepository.findByGymIdAndIdIn(GYM_ID, List.of("invalid-type"))).thenReturn(List.of());

        assertThatThrownBy(() -> trainerService.updateTrainerTypes(TRAINER_ID, List.of("invalid-type")))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("trainer types are invalid");
    }

    @Test
    @DisplayName("getTrainers — rejects removed PENDING_APPROVAL status filter")
    void testGetTrainers_RejectsPendingApprovalFilter() {
        when(userRepository.findByGymIdAndRole(GYM_ID, "TRAINER")).thenReturn(List.of());

        assertThatThrownBy(() -> trainerService.getTrainers("PENDING_APPROVAL"))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Status filter must be ACTIVE, INACTIVE, or ALL");
    }

    @Test
    @DisplayName("deactivateTrainer — deactivates trainer, bumps tokenVersion, and auto-ends active assignments")
    void testDeactivateTrainer_EndsAssignments() {
        User trainer = User.builder()
                .id(TRAINER_ID)
                .gymId(GYM_ID)
                .name("Sam")
                .role("TRAINER")
                .active(true)
                .status("ACTIVE")
                .tokenVersion(0)
                .build();

        when(userRepository.findByIdAndGymId(TRAINER_ID, GYM_ID)).thenReturn(Optional.of(trainer));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TrainerResponse res = trainerService.deactivateTrainer(TRAINER_ID);

        assertThat(res.isActive()).isFalse();
        assertThat(res.getStatus()).isEqualTo("INACTIVE");
        assertThat(trainer.getTokenVersion()).isEqualTo(1);
        verify(refreshTokenRepository).deleteByUserId(TRAINER_ID);
        verify(trainerAssignmentService).endAllActiveAssignmentsForTrainer(eq(GYM_ID), eq(TRAINER_ID), any());
        verify(auditLogService).log(eq("TRAINER_DEACTIVATED"), eq(TRAINER_ID), anyString());
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

        assertThatThrownBy(() -> trainerService.updateTrainerTypes(TRAINER_ID, java.util.List.of("t-1")))
                .isInstanceOf(AppException.class)
                .hasMessageContaining("Access denied");
    }
}
