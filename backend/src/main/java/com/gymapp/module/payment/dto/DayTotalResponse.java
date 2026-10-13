package com.gymapp.module.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DayTotalResponse {
    private String date; // "yyyy-MM-dd"
    private long totalPaise;
}
