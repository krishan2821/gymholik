package com.gymapp.module.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApplyDiscountRequest {

    @NotNull(message = "Discount amount is required")
    @Positive(message = "Discount amount must be positive")
    private Long discountPaise;

    @NotBlank(message = "Discount reason is required")
    @Size(min = 5, max = 300, message = "Reason must be between 5 and 300 characters")
    private String reason;
}
