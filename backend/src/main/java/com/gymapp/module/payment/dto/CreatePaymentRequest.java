package com.gymapp.module.payment.dto;


import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreatePaymentRequest {

    @NotBlank(message = "Member ID is required")
    private String memberId;

    @NotBlank(message = "Membership ID is required")
    private String membershipId;

    @NotNull(message = "Amount is required")
    @Positive(message = "Amount must be positive")
    private Long amountPaise; // paise

    @NotNull(message = "Payment mode is required")
    private String mode;

    private LocalDate paymentDate; // defaults to today if null

    private String reason;
    private String idempotencyKey;
}
