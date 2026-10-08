package com.gymapp.module.dashboard.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.dashboard.dto.DashboardResponse;
import com.gymapp.module.member.entity.Member;
import com.gymapp.security.JwtDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("DashboardService Unit Tests")
class DashboardServiceTest {

    @Mock
    private MongoTemplate mongoTemplate;

    @InjectMocks
    private DashboardService dashboardService;

    private static final String GYM_ID = "gym-dashboard-test";
    private static final String RAW_PHONE = "9876543210";
    private static final String MASKED_PHONE = "XXXXXX3210";

    @BeforeEach
    void setUp() {
        TenantContext.setGymId(GYM_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    private void authenticateAs(String role) {
        var auth = new UsernamePasswordAuthenticationToken("user-1", null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
        auth.setDetails(new JwtDetails("user-1", GYM_ID, role));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private void mockMongoQueries(Member member) {
        when(mongoTemplate.count(any(Query.class), eq("members"))).thenReturn(5L);
        when(mongoTemplate.count(any(Query.class), eq("attendances"))).thenReturn(2L);

        AggregationResults<Map> emptyAggResults = mock(AggregationResults.class);
        when(emptyAggResults.getMappedResults()).thenReturn(Collections.emptyList());
        when(mongoTemplate.aggregate(any(Aggregation.class), any(String.class), eq(Map.class)))
                .thenReturn(emptyAggResults);

        when(mongoTemplate.find(any(Query.class), eq(Member.class))).thenReturn(List.of(member));
    }

    @Test
    @DisplayName("getDashboardData — TRAINER access throws ACCESS_DENIED")
    void testGetDashboardData_TrainerDenied() {
        authenticateAs("TRAINER");

        assertThatThrownBy(() -> dashboardService.getDashboardData())
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode()).isEqualTo(ErrorCode.ACCESS_DENIED));
    }

    @Test
    @DisplayName("getDashboardData — STAFF receives masked phone when staffCanSeeFullPhone is false")
    void testGetDashboardData_StaffMaskedPhone() {
        authenticateAs("STAFF");

        Member member = Member.builder()
                .id("mem-1")
                .gymId(GYM_ID)
                .name("Alex")
                .phone(RAW_PHONE)
                .currentExpiry(LocalDate.now().plusDays(2))
                .build();

        mockMongoQueries(member);

        Gym gym = Gym.builder().id(GYM_ID).staffCanSeeFullPhone(false).build();
        when(mongoTemplate.findById(GYM_ID, Gym.class)).thenReturn(gym);

        DashboardResponse res = dashboardService.getDashboardData();

        assertThat(res.getExpiringSoonList()).hasSize(1);
        assertThat(res.getExpiringSoonList().get(0).getPhone()).isEqualTo(MASKED_PHONE);
    }

    @Test
    @DisplayName("getDashboardData — OWNER receives full unmasked phone")
    void testGetDashboardData_OwnerUnmaskedPhone() {
        authenticateAs("OWNER");

        Member member = Member.builder()
                .id("mem-1")
                .gymId(GYM_ID)
                .name("Alex")
                .phone(RAW_PHONE)
                .currentExpiry(LocalDate.now().plusDays(2))
                .build();

        mockMongoQueries(member);

        Gym gym = Gym.builder().id(GYM_ID).staffCanSeeFullPhone(false).build();
        when(mongoTemplate.findById(GYM_ID, Gym.class)).thenReturn(gym);

        DashboardResponse res = dashboardService.getDashboardData();

        assertThat(res.getExpiringSoonList()).hasSize(1);
        assertThat(res.getExpiringSoonList().get(0).getPhone()).isEqualTo(RAW_PHONE);
    }
}
