package com.gymapp.module.member.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberFeesResponse {
    private List<MembershipFeeItem> memberships;
    private long dueTotalPaise;
    private String defaultMembershipId;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MembershipFeeItem {
        private String id;
        private String planName;
        private LocalDate startDate;
        private LocalDate expiryDate;
        private String status;
        private long totalPaise;
        private long discountPaise;
        private long paidPaise;
        private long duePaise;
    }
}
