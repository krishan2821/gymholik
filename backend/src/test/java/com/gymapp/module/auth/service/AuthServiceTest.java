package com.gymapp.module.auth.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.audit.service.AuditLogService;
import com.gymapp.module.auth.dto.*;
import com.gymapp.module.auth.entity.*;
import com.gymapp.module.auth.repository.*;
import com.gymapp.module.plan.service.PlanService;
import com.gymapp.module.trainer.repository.TrainerTypeRepository;
import com.gymapp.module.trainer.service.TrainerTypeService;
import com.gymapp.security.JwtUtil;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService Unit Tests")
class AuthServiceTest {

    @Mock GymRepository gymRepository;
    @Mock UserRepository userRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock JwtUtil jwtUtil;
    @Mock TrainerTypeService trainerTypeService;
    @Mock TrainerTypeRepository trainerTypeRepository;
    @Mock PlanService planService;
    @Mock AuditLogService auditLogService;
    @Mock GymCodeGenerator gymCodeGenerator;

    @InjectMocks AuthService authService;

    @BeforeEach
    void injectValues() {
        ReflectionTestUtils.setField(authService, "trialDurationDays", 14);
        ReflectionTestUtils.setField(authService, "refreshTokenExpiryDays", 30);
    }

    @AfterEach
    void cleanTenantContext() {
        TenantContext.clear();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  completeRegistration
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("completeRegistration()")
    class CompleteRegistrationTests {

        @Test
        @DisplayName("success — creates gym (14-day TRIAL, gymCode, default plans & trainer types) and ACTIVE OWNER, returns tokens")
        void success() {
            var req = CompleteRegistrationRequest.builder()
                    .gymName("FitZone")
                    .gymType(GymType.COMMERCIAL)
                    .ownerName("John Owner")
                    .email("john@fitzone.in")
                    .address(CompleteRegistrationRequest.AddressDto.builder()
                            .line1("123 Test Street")
                            .state("Maharashtra")
                            .district("Mumbai")
                            .pincode("400001")
                            .build())
                    .acceptedTerms(true)
                    .termsVersion("1.0")
                    .build();

            when(userRepository.existsByPhone("9876543210")).thenReturn(false);
            when(gymRepository.existsByPhone("9876543210")).thenReturn(false);
            when(gymCodeGenerator.generate()).thenReturn("ABC23456");
            when(gymRepository.existsByGymCode("ABC23456")).thenReturn(false);
            when(gymRepository.save(any(Gym.class))).thenAnswer(inv -> {
                Gym g = inv.getArgument(0);
                g.setId("gym-abc");
                return g;
            });
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId("owner-1");
                return u;
            });
            when(jwtUtil.generateAccessToken("owner-1", "gym-abc", "OWNER")).thenReturn("access-jwt");
            when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            VerifyOtpResponse res = authService.completeRegistration("9876543210", "reg-token-1", req);

            assertThat(res.isNewUser()).isFalse();
            assertThat(res.getAccessToken()).isEqualTo("access-jwt");
            assertThat(res.getRefreshToken()).isNotBlank();
            assertThat(res.getUser().getId()).isEqualTo("owner-1");
            assertThat(res.getUser().getName()).isEqualTo("John Owner");
            assertThat(res.getUser().getRole()).isEqualTo("OWNER");
            assertThat(res.getUser().getGymId()).isEqualTo("gym-abc");
            assertThat(res.getUser().getGymName()).isEqualTo("FitZone");
            assertThat(res.getGym()).isNotNull();
            assertThat(res.getGym().getGymCode()).isEqualTo("ABC23456");
            assertThat(res.getGym().getGymType()).isEqualTo("COMMERCIAL");

            verify(gymRepository).save(argThat(g ->
                    "TRIAL".equals(g.getStatus())
                    && "ABC23456".equals(g.getGymCode())
                    && GymType.COMMERCIAL.equals(g.getGymType())
                    && g.getSubscriptionValidTill().equals(LocalDate.now().plusDays(14))));
            verify(userRepository).save(argThat(u ->
                    "OWNER".equals(u.getRole())
                    && "ACTIVE".equals(u.getStatus())
                    && u.isActive()
                    && "9876543210".equals(u.getPhone())
                    && "john@fitzone.in".equals(u.getEmail())));
            verify(planService).seedDefaultsForGym("gym-abc");
            verify(trainerTypeService).seedDefaultsForGym("gym-abc");
        }

        @Test
        @DisplayName("duplicate phone (race condition) → 409 PHONE_ALREADY_EXISTS")
        void duplicatePhone() {
            var req = CompleteRegistrationRequest.builder()
                    .gymName("FitZone")
                    .gymType(GymType.COMMERCIAL)
                    .ownerName("John Owner")
                    .address(CompleteRegistrationRequest.AddressDto.builder()
                            .line1("123 Test Street")
                            .state("Maharashtra")
                            .district("Mumbai")
                            .pincode("400001")
                            .build())
                    .acceptedTerms(true)
                    .termsVersion("1.0")
                    .build();

            when(userRepository.existsByPhone("9876543210")).thenReturn(true);

            assertThatThrownBy(() -> authService.completeRegistration("9876543210", "reg-token-race", req))
                    .isInstanceOf(AppException.class)
                    .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                            .isEqualTo(ErrorCode.PHONE_ALREADY_EXISTS));

            verify(gymRepository, never()).save(any());
        }

        @Test
        @DisplayName("reusing the same registrationToken → 401 INVALID_TOKEN")
        void singleUseRegistrationToken() {
            var req = CompleteRegistrationRequest.builder()
                    .gymName("FitZone")
                    .gymType(GymType.COMMERCIAL)
                    .ownerName("John Owner")
                    .address(CompleteRegistrationRequest.AddressDto.builder()
                            .line1("123 Test Street")
                            .state("Maharashtra")
                            .district("Mumbai")
                            .pincode("400001")
                            .build())
                    .acceptedTerms(true)
                    .termsVersion("1.0")
                    .build();

            when(userRepository.existsByPhone("9876543211")).thenReturn(false);
            when(gymRepository.existsByPhone("9876543211")).thenReturn(false);
            when(gymCodeGenerator.generate()).thenReturn("ABC23456");
            when(gymRepository.existsByGymCode("ABC23456")).thenReturn(false);
            when(gymRepository.save(any(Gym.class))).thenAnswer(inv -> {
                Gym g = inv.getArgument(0);
                g.setId("gym-1");
                return g;
            });
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId("owner-1");
                return u;
            });
            when(jwtUtil.generateAccessToken(any(), any(), any())).thenReturn("access-jwt");
            when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            authService.completeRegistration("9876543211", "single-use-token", req);

            assertThatThrownBy(() -> authService.completeRegistration("9876543211", "single-use-token", req))
                    .isInstanceOf(AppException.class)
                    .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                            .isEqualTo(ErrorCode.INVALID_TOKEN));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  refreshToken
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("refreshToken()")
    class RefreshTokenTests {

        @Test
        @DisplayName("valid token → rotated and new pair returned")
        void success() {
            User user = User.builder()
                    .id("user-1")
                    .gymId("gym-1")
                    .phone("9876543210")
                    .role("OWNER")
                    .active(true)
                    .status("ACTIVE")
                    .build();

            RefreshToken stored = RefreshToken.builder()
                    .token("rt-uuid")
                    .userId("user-1")
                    .gymId("gym-1")
                    .expiresAt(LocalDateTime.now().plusDays(29))
                    .build();

            when(refreshTokenRepository.findByToken("rt-uuid")).thenReturn(Optional.of(stored));
            when(userRepository.findByIdAndGymId("user-1", "gym-1")).thenReturn(Optional.of(user));
            when(jwtUtil.generateAccessToken(any(), any(), any())).thenReturn("new-access");
            when(jwtUtil.getAccessTokenExpiryMs()).thenReturn(1_800_000L);
            when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            var req = new RefreshTokenRequest();
            req.setRefreshToken("rt-uuid");

            TokenResponse resp = authService.refreshToken(req);

            assertThat(resp.getAccessToken()).isEqualTo("new-access");
            verify(refreshTokenRepository).delete(stored);
        }

        @Test
        @DisplayName("expired token → REFRESH_TOKEN_NOT_FOUND and token deleted")
        void expiredToken() {
            RefreshToken expired = RefreshToken.builder()
                    .token("old-rt")
                    .expiresAt(LocalDateTime.now().minusDays(1))
                    .build();

            when(refreshTokenRepository.findByToken("old-rt")).thenReturn(Optional.of(expired));

            var req = new RefreshTokenRequest();
            req.setRefreshToken("old-rt");

            assertThatThrownBy(() -> authService.refreshToken(req))
                    .isInstanceOf(AppException.class)
                    .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                            .isEqualTo(ErrorCode.REFRESH_TOKEN_NOT_FOUND));

            verify(refreshTokenRepository).delete(expired);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  createStaff
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("createStaff()")
    class CreateStaffTests {

        @Test
        @DisplayName("success — staff saved with correct gymId and role, logs STAFF_CREATED without phone")
        void success() {
            TenantContext.setGymId("gym-xyz");

            var req = new CreateStaffRequest();
            req.setName("Jane Doe");
            req.setPhone("9999988888");

            when(userRepository.existsByPhone("9999988888")).thenReturn(false);
            when(userRepository.save(any())).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId("staff-1");
                return u;
            });

            StaffResponse res = authService.createStaff(req);

            assertThat(res.getId()).isEqualTo("staff-1");
            assertThat(res.getRole()).isEqualTo("STAFF");
            assertThat(res.getStatus()).isEqualTo("ACTIVE");
            assertThat(res.isActive()).isTrue();

            verify(userRepository).save(argThat(u ->
                    u.getRole().equals("STAFF")
                    && u.getGymId().equals("gym-xyz")
                    && "ACTIVE".equals(u.getStatus())
                    && u.isActive()));
            verify(auditLogService).log(eq("STAFF_CREATED"), eq("staff-1"), argThat(details -> !details.contains("9999988888")));
        }

        @Test
        @DisplayName("duplicate phone → 409 PHONE_ALREADY_REGISTERED with neutral message")
        void duplicatePhone() {
            TenantContext.setGymId("gym-xyz");

            var req = new CreateStaffRequest();
            req.setName("Jane Doe");
            req.setPhone("9999988888");

            when(userRepository.existsByPhone("9999988888")).thenReturn(true);

            assertThatThrownBy(() -> authService.createStaff(req))
                    .isInstanceOf(AppException.class)
                    .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                            .isEqualTo(ErrorCode.PHONE_ALREADY_REGISTERED));

            verify(userRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("updateStaff()")
    class UpdateStaffTests {

        @Test
        @DisplayName("deactivate staff bumps tokenVersion and deletes refresh tokens")
        void deactivateStaff() {
            TenantContext.setGymId("gym-xyz");
            User staff = User.builder()
                    .id("staff-1")
                    .gymId("gym-xyz")
                    .name("Staff Person")
                    .phone("9876543210")
                    .role("STAFF")
                    .active(true)
                    .status("ACTIVE")
                    .tokenVersion(0)
                    .build();

            when(userRepository.findByIdAndGymId("staff-1", "gym-xyz")).thenReturn(Optional.of(staff));
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            UpdateStaffRequest req = UpdateStaffRequest.builder().active(false).build();
            StaffResponse res = authService.updateStaff("staff-1", req);

            assertThat(res.isActive()).isFalse();
            assertThat(res.getStatus()).isEqualTo("INACTIVE");
            assertThat(staff.getTokenVersion()).isEqualTo(1);
            verify(refreshTokenRepository).deleteByUserId("staff-1");
        }
    }

    @Nested
    @DisplayName("getStaffList()")
    class GetStaffListTests {
        @Test
        @DisplayName("returns staff scoped to current gym")
        void returnsStaffScopedToGym() {
            TenantContext.setGymId("gym-xyz");
            User staff = User.builder()
                    .id("staff-1")
                    .gymId("gym-xyz")
                    .name("Staff Person")
                    .phone("9876543210")
                    .role("STAFF")
                    .active(true)
                    .status("ACTIVE")
                    .build();

            when(userRepository.findByGymIdAndRole("gym-xyz", "STAFF"))
                    .thenReturn(List.of(staff));

            var list = authService.getStaffList();
            assertThat(list).hasSize(1);
            assertThat(list.get(0).getName()).isEqualTo("Staff Person");
            assertThat(list.get(0).getGymId()).isEqualTo("gym-xyz");
        }
    }
}
