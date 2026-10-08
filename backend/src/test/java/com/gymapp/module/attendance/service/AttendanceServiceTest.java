package com.gymapp.module.attendance.service;

import com.gymapp.common.PagedResponse;
import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.attendance.dto.AbsentMemberResponse;
import com.gymapp.module.attendance.dto.CheckInRequest;
import com.gymapp.module.attendance.repository.AttendanceRepository;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
import com.gymapp.module.trainer.entity.TrainerAssignment;
import com.gymapp.module.trainer.repository.TrainerAssignmentRepository;
import com.gymapp.security.JwtDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AttendanceService Unit Tests")
class AttendanceServiceTest {

    @Mock private AttendanceRepository attendanceRepository;
    @Mock private MemberRepository memberRepository;
    @Mock private MembershipRepository membershipRepository;
    @Mock private MongoTemplate mongoTemplate;
    @Mock private TrainerAssignmentRepository trainerAssignmentRepository;

    @InjectMocks private AttendanceService attendanceService;

    private static final String GYM_ID = "gym-att-test";
    private static final String TRAINER_ID = "trainer-100";

    @BeforeEach
    void setUp() {
        TenantContext.setGymId(GYM_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    private void authenticateAsTrainer() {
        var auth = new UsernamePasswordAuthenticationToken(TRAINER_ID, null,
                List.of(new SimpleGrantedAuthority("ROLE_TRAINER")));
        auth.setDetails(new JwtDetails(TRAINER_ID, GYM_ID, "TRAINER"));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("checkIn — trainer calling checkIn throws ACCESS_DENIED")
    void testCheckIn_TrainerDenied() {
        authenticateAsTrainer();

        CheckInRequest req = new CheckInRequest();
        req.setMemberId("mem-1");

        assertThatThrownBy(() -> attendanceService.checkIn(req))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    @Test
    @DisplayName("getAbsentMembers — trainer with no active assignments receives empty list immediately")
    void testGetAbsentMembers_TrainerNoAssignments_Empty() {
        authenticateAsTrainer();

        when(trainerAssignmentRepository.findByGymIdAndTrainerIdAndStatus(GYM_ID, TRAINER_ID, "ACTIVE"))
                .thenReturn(List.of());

        PagedResponse<AbsentMemberResponse> res = attendanceService.getAbsentMembers(3, PageRequest.of(0, 10));

        assertThat(res.getContent()).isEmpty();
    }

    @Test
    @DisplayName("getAbsentMembers — trainer with assigned members queries with assigned filter and returns masked phone")
    void testGetAbsentMembers_TrainerWithAssignments() {
        authenticateAsTrainer();

        TrainerAssignment assignment = TrainerAssignment.builder()
                .gymId(GYM_ID)
                .trainerId(TRAINER_ID)
                .memberId("mem-1")
                .status("ACTIVE")
                .build();

        when(trainerAssignmentRepository.findByGymIdAndTrainerIdAndStatus(GYM_ID, TRAINER_ID, "ACTIVE"))
                .thenReturn(List.of(assignment));

        Member member = Member.builder()
                .id("mem-1")
                .gymId(GYM_ID)
                .name("Alice")
                .phone("9876543210")
                .memberCode("MEM001")
                .lastAttendanceDate(LocalDate.now().minusDays(5))
                .status("ACTIVE")
                .build();

        when(mongoTemplate.count(any(Query.class), eq(Member.class))).thenReturn(1L);
        when(mongoTemplate.find(any(Query.class), eq(Member.class))).thenReturn(List.of(member));

        PagedResponse<AbsentMemberResponse> res = attendanceService.getAbsentMembers(3, PageRequest.of(0, 10));

        assertThat(res.getContent()).hasSize(1);
        assertThat(res.getContent().get(0).getMemberId()).isEqualTo("mem-1");
        assertThat(res.getContent().get(0).getPhone()).isEqualTo("XXXXXX3210");
    }
}
