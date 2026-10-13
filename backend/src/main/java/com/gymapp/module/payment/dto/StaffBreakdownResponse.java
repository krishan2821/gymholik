package com.gymapp.module.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffBreakdownResponse {
    private String staffId;
    private String name;
    private long amountPaise;
    private long count;
}
