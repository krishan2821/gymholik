package com.gymapp.module.payment.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MembershipDueItem {
    private String membershipId;
    private String planName;
    private long totalPaise;
    private long paidPaise;
    private long duePaise;
    private LocalDate startDate;
    private LocalDate expiryDate;
    private LocalDate promisedDate;
    private Boolean promiseBroken;
}
