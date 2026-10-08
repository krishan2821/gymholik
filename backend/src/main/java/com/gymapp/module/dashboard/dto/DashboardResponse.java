package com.gymapp.module.dashboard.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DashboardResponse {
    private long activeMembers;
    private Long todayCollection; // in paise
    private Long monthCollection; // in paise
    private long expiringSoon; // in next 5 days
    private long newJoinings; // this month
    private long todayAttendance;
    private Long totalDue; // in paise
    
    private java.util.List<ExpiringMemberResponse> expiringSoonList;
    private java.util.List<DailyCollectionResponse> last7DaysCollection;
    private long subscriptionDaysRemaining;
}
