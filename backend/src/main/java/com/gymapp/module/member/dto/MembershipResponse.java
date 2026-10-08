package com.gymapp.module.member.dto;


import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class MembershipResponse {
    private String id;
    private String gymId;
    private String memberId;
    private String planId;
    private String planName;
    private long totalPaise;
    private long paidPaise;
    private long duePaise;
    private LocalDate startDate;
    private LocalDate expiryDate;
    private String status;
    private LocalDateTime createdAt;
}
