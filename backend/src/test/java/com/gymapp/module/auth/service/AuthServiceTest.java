package com.gymapp.module.auth.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.auth.dto.*;
import com.gymapp.module.auth.entity.*;
import com.gymapp.module.auth.repository.*;
import com.gymapp.security.JwtUtil;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService Unit Tests")
class AuthServiceTest {

    @Mock GymRepository         gymRepository;
    @Mock UserRepository        userRepository;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock LoginAttemptRepository loginAttemptRepository;
    @Mock PasswordEncoder        passwordEncoder;
    @Mock JwtUtil                jwtUtil;
    @Mock com.gymapp.module.trainer.service.TrainerTypeService trainerTypeService;

    @InjectMocks AuthService authService;

    @BeforeEach
    void injectValues() {
        ReflectionTestUtils.setField(authService, "trialDurationDays",      14);
        ReflectionTestUtils.setField(authService, "refreshTokenExpiryDays", 30);
        ReflectionTestUtils.setField(authService, "maxLoginAttempts",        5);
        ReflectionTestUtils.setField(authService, "lockoutMinutes",          15);
    }

    @AfterEach
    void cleanTenantContext() {
        TenantContext.clear();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  registerGym
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("registerGym()")
    class RegisterGymTests {

        @Test
        @DisplayName("success — creates gym and owner, returns gymCode and trialEndsAt")
        void success() {
            var req = buildRegisterRequest();

            when(gymRepository.existsByPhone("9876543210")).thenReturn(false);
            when(gymRepository.existsByGymCode(anyString())).thenReturn(false);
            when(gymRepository.save(any(Gym.class))).thenAnswer(inv -> {
                Gym g = inv.getArgument(0);
                g.setId("gym-abc");
                return g;
            });
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
            when(passwordEncoder.encode("Pass1234!")).thenReturn("hashed");

            GymResponse res = authService.registerGym(req);

            assertThat(res.getGymId()).isEqualTo("gym-abc");
            assertThat(res.getGymName()).isEqualTo("FitZone");
            assertThat(res.getGymCode()).isNotBlank();
            assertThat(res.getTrialEndsAt()).isAfter(LocalDateTime.now());

            verify(gymRepository).save(any(Gym.class));
            verify(userRepository).save(argThat(u ->
                    u.getRole().equals("OWNER")
                    && u.getGymId().equals("gym-abc")
                    && u.isActive()));
        }

        @Test
        @DisplayName("duplicate gym phone → PHONE_ALREADY_EXISTS")
        void duplicatePhone() {
            var req = buildRegisterRequest();
            when(gymRepository.existsByPhone("9876543210")).thenReturn(true);

            assertThatThrownBy(() -> authService.registerGym(req))
                    .isInstanceOf(AppException.class)
                    .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                            .isEqualTo(ErrorCode.PHONE_ALREADY_EXISTS));

            verify(gymRepository, never()).save(any());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  login
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("login()")
    class LoginTests {

        @Test
        @DisplayName("success — returns access and refresh tokens")
        void success() {
            Gym  gym  = activeGym();
            User user = ownerUser(gym.getId());

            stubSuccessfulGymLogin(gym, user);
            when(jwtUtil.generateAccessToken(any(), any(), any())).thenReturn("access-jwt");
            when(jwtUtil.getAccessTokenExpiryMs()).thenReturn(1_800_000L);
            when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            TokenResponse resp = authService.login(loginReq(gym.getGymCode()));

            assertThat(resp.getAccessToken()).isEqualTo("access-jwt");
            assertThat(resp.getGymId()).isEqualTo(gym.getId());
            assertThat(resp.getRole()).isEqualTo("OWNER");
            assertThat(resp.getRefreshToken()).isNotBlank();
        }

        @Test
        @DisplayName("success without gymCode — auto-detects gym for owner")
        void successWithoutGymCode() {
            Gym  gym  = activeGym();
            User user = ownerUser(gym.getId());

            when(loginAttemptRepository.findByKey(any())).thenReturn(Optional.empty());
            when(userRepository.findByPhoneAndRole(user.getPhone(), "SUPER_ADMIN")).thenReturn(Optional.empty());
            when(userRepository.findByPhone(user.getPhone())).thenReturn(Optional.of(user));
            when(gymRepository.findById(gym.getId())).thenReturn(Optional.of(gym));
            when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
            when(jwtUtil.generateAccessToken(any(), any(), any())).thenReturn("access-jwt");
            when(jwtUtil.getAccessTokenExpiryMs()).thenReturn(1_800_000L);
            when(refreshTokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            TokenResponse resp = authService.login(loginReq(null)); // gymCode is null

            assertThat(resp.getAccessToken()).isEqualTo("access-jwt");
            assertThat(resp.getGymId()).isEqualTo(gym.getId());
            assertThat(resp.getGymCode()).isEqualTo(gym.getGymCode());
            assertThat(resp.getRole()).isEqualTo("OWNER");
        }

        @Test
        @DisplayName("wrong password → INVALID_CREDENTIALS and attempt recorded")
        void wrongPassword() {
            Gym  gym  = activeGym();
            User user = ownerUser(gym.getId());

            when(loginAttemptRepository.findByKey(any())).thenReturn(Optional.empty());
            when(gymRepository.findByGymCode(gym.getGymCode())).thenReturn(Optional.of(gym));
            when(userRepository.findByPhone(user.getPhone()))
                    .thenReturn(Optional.of(user));
            when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);
            when(loginAttemptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatThrownBy(() -> authService.login(loginReq(gym.getGymCode())))
                    .isInstanceOf(AppException.class)
                    .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                            .isEqualTo(ErrorCode.INVALID_CREDENTIALS));

            verify(loginAttemptRepository).save(argThat(a -> a.getAttemptCount() == 1));
        }

        @Test
        @DisplayName("5 failed attempts → INVALID_CREDENTIALS thrown AND account locked in DB")
        void locksAfterMaxAttempts() {
            Gym  gym  = activeGym();
            User user = ownerUser(gym.getId());

            // Simulate 4 previous failed attempts already stored
            LoginAttempt existing = LoginAttempt.builder()
                    .key(gym.getId() + ":" + user.getPhone())
                    .attemptCount(4)
                    .build();

            when(loginAttemptRepository.findByKey(any())).thenReturn(Optional.of(existing));
            when(gymRepository.findByGymCode(gym.getGymCode())).thenReturn(Optional.of(gym));
            when(userRepository.findByPhone(user.getPhone()))
                    .thenReturn(Optional.of(user));
            when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);
            when(loginAttemptRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            // 5th attempt: login still fails with INVALID_CREDENTIALS...
            assertThatThrownBy(() -> authService.login(loginReq(gym.getGymCode())))
                    .isInstanceOf(AppException.class)
                    .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                            .isEqualTo(ErrorCode.INVALID_CREDENTIALS));

            // ...but lockout is now recorded in the DB (attemptCount=5, lockedUntil set)
            verify(loginAttemptRepository).save(argThat(a ->
                    a.getAttemptCount() == 5 && a.getLockedUntil() != null));
        }

        @Test
        @DisplayName("account currently locked → ACCOUNT_LOCKED")
        void lockedAccount() {
            Gym gym = activeGym();

            LoginAttempt locked = LoginAttempt.builder()
                    .key(gym.getId() + ":9876543210")
                    .attemptCount(5)
                    .lockedUntil(LocalDateTime.now().plusMinutes(10))
                    .build();

            when(gymRepository.findByGymCode(gym.getGymCode())).thenReturn(Optional.of(gym));
            when(loginAttemptRepository.findByKey(any())).thenReturn(Optional.of(locked));

            assertThatThrownBy(() -> authService.login(loginReq(gym.getGymCode())))
                    .isInstanceOf(AppException.class)
                    .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                            .isEqualTo(ErrorCode.ACCOUNT_LOCKED));
        }

        @Test
        @DisplayName("suspended gym → GYM_SUSPENDED")
        void suspendedGym() {
            Gym suspended = activeGym();
            suspended.setStatus("SUSPENDED");

            when(gymRepository.findByGymCode(suspended.getGymCode())).thenReturn(Optional.of(suspended));

            assertThatThrownBy(() -> authService.login(loginReq(suspended.getGymCode())))
                    .isInstanceOf(AppException.class)
                    .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                            .isEqualTo(ErrorCode.GYM_SUSPENDED));
        }

        @Test
        @DisplayName("expired trial → GYM_TRIAL_EXPIRED")
        void expiredTrial() {
            Gym trialExpired = Gym.builder()
                    .id("gym-1").gymCode("GYM0001")
                    .status("TRIAL")
                    .subscriptionValidTill(LocalDateTime.now().minusDays(1).toLocalDate())  // already expired
                    .build();

            when(gymRepository.findByGymCode("GYM0001")).thenReturn(Optional.of(trialExpired));

            var req = loginReq("GYM0001");
            assertThatThrownBy(() -> authService.login(req))
                    .isInstanceOf(AppException.class)
                    .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                            .isEqualTo(ErrorCode.GYM_TRIAL_EXPIRED));
        }

        @Test
        @DisplayName("inactive user → ACCESS_DENIED")
        void inactiveUser() {
            Gym  gym  = activeGym();
            User user = ownerUser(gym.getId());
            user.setActive(false);

            when(loginAttemptRepository.findByKey(any())).thenReturn(Optional.empty());
            when(gymRepository.findByGymCode(gym.getGymCode())).thenReturn(Optional.of(gym));
            when(userRepository.findByPhone(user.getPhone()))
                    .thenReturn(Optional.of(user));

            assertThatThrownBy(() -> authService.login(loginReq(gym.getGymCode())))
                    .isInstanceOf(AppException.class)
                    .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                            .isEqualTo(ErrorCode.ACCESS_DENIED));
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
            User user = ownerUser("gym-1");
            user.setId("user-1");

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
            verify(refreshTokenRepository).delete(stored); // old token deleted
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

            verify(refreshTokenRepository).delete(expired); // expired token cleaned up
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  createStaff
    // ═══════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("createStaff()")
    class CreateStaffTests {

        @Test
        @DisplayName("success — staff saved with correct gymId and role")
        void success() {
            TenantContext.setGymId("gym-xyz");

            var req = new CreateStaffRequest();
            req.setName("Jane Doe");
            req.setPhone("9999988888");
            req.setPassword("SecurePass1");

            when(userRepository.existsByPhone("9999988888")).thenReturn(false);
            when(passwordEncoder.encode("SecurePass1")).thenReturn("hashed-staff");
            when(userRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatNoException().isThrownBy(() -> authService.createStaff(req));

            verify(userRepository).save(argThat(u ->
                    u.getRole().equals("STAFF")
                    && u.getGymId().equals("gym-xyz")
                    && u.isActive()));
        }

        @Test
        @DisplayName("duplicate phone in gym → USER_ALREADY_EXISTS")
        void duplicatePhone() {
            TenantContext.setGymId("gym-xyz");

            var req = new CreateStaffRequest();
            req.setPhone("9999988888");

            when(userRepository.existsByPhone("9999988888")).thenReturn(true);

            assertThatThrownBy(() -> authService.createStaff(req))
                    .isInstanceOf(AppException.class)
                    .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                            .isEqualTo(ErrorCode.USER_ALREADY_EXISTS));

            verify(userRepository, never()).save(any());
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
                    .thenReturn(java.util.List.of(staff));

            var list = authService.getStaffList();
            assertThat(list).hasSize(1);
            assertThat(list.get(0).getName()).isEqualTo("Staff Person");
            assertThat(list.get(0).getGymId()).isEqualTo("gym-xyz");
        }
    }

    @Nested
    @DisplayName("changePassword()")
    class ChangePasswordTests {
        @Test
        @DisplayName("uses findByIdAndGymId when gymId is present")
        void usesTenantIsolatedLookup() {
            TenantContext.setGymId("gym-xyz");
            User owner = ownerUser("gym-xyz");

            when(userRepository.findByIdAndGymId("user-1", "gym-xyz"))
                    .thenReturn(Optional.of(owner));
            when(passwordEncoder.matches("old-pw", "hashed-pw")).thenReturn(true);
            when(passwordEncoder.encode("new-pw")).thenReturn("new-hashed-pw");

            ChangePasswordRequest req = new ChangePasswordRequest();
            req.setOldPassword("old-pw");
            req.setNewPassword("new-pw");

            authService.changePassword("user-1", req);

            assertThat(owner.getPasswordHash()).isEqualTo("new-hashed-pw");
            verify(userRepository).save(owner);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Test data builders
    // ═══════════════════════════════════════════════════════════════════════════

    private RegisterGymRequest buildRegisterRequest() {
        var req = new RegisterGymRequest();
        req.setGymName("FitZone");
        req.setOwnerName("John Owner");
        req.setOwnerPhone("9876543210");
        req.setPassword("Pass1234!");
        return req;
    }

    private Gym activeGym() {
        return Gym.builder()
                .id("gym-1")
                .gymCode("GYM0001")
                .status("ACTIVE")
                .build();
    }

    private User ownerUser(String gymId) {
        return User.builder()
                .id("user-1")
                .gymId(gymId)
                .phone("9876543210")
                .passwordHash("hashed-pw")
                .role("OWNER")
                .active(true)
                .build();
    }

    private LoginRequest loginReq(String gymCode) {
        var req = new LoginRequest();
        req.setPhone("9876543210");
        req.setPassword("any-password");
        req.setGymCode(gymCode);
        return req;
    }

    private void stubSuccessfulGymLogin(Gym gym, User user) {
        when(loginAttemptRepository.findByKey(any())).thenReturn(Optional.empty());
        when(gymRepository.findByGymCode(gym.getGymCode())).thenReturn(Optional.of(gym));
        when(userRepository.findByPhone(user.getPhone()))
                .thenReturn(Optional.of(user));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
    }
}
