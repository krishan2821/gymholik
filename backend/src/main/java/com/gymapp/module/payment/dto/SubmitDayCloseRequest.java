package com.gymapp.module.payment.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitDayCloseRequest {
    @NotNull(message = "Date is required")
    private LocalDate date;

    @NotNull(message = "Counted cash is required")
    private Long countedCashPaise;

    private String note;
}
