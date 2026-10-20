package com.gymapp.module.payment.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DueItemResponse {
    private String memberId;
    private String name;
    private String memberName;
    private String memberCode;
    private String phone;
    private String membershipId;
    private String planName;
    private long duePaise;
    private long totalDuePaise; // alias for duePaise for backward compatibility
    private long totalPaise;
    private long paidPaise;
    private LocalDate startDate;
    private LocalDate expiryDate;
    private Long daysOverdue;
    private Long daysToExpiry;
    private String status;
    private LocalDateTime lastPaymentAt;
    private LocalDate promisedDate;
    private Boolean promiseBroken;
    private java.util.List<MembershipDueItem> memberships;
}
