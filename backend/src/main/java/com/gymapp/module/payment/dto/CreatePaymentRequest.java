package com.gymapp.module.payment.dto;


import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreatePaymentRequest {

    @NotBlank(message = "Member ID is required")
    private String memberId;

    private String membershipId;

    @NotNull(message = "Amount is required")
    @Positive(message = "Amount must be positive")
    private Long amountPaise; // paise

    @NotNull(message = "Payment mode is required")
    private String mode;

    @JsonDeserialize(using = FlexibleLocalDateDeserializer.class)
    private LocalDate receivedAt; // optional business date of payment (defaults to now)

    @JsonDeserialize(using = FlexibleLocalDateDeserializer.class)
    private LocalDate paymentDate; // alias for receivedAt

    @JsonDeserialize(using = FlexibleLocalDateDeserializer.class)
    private LocalDate paidDate; // alias for receivedAt

    private String reason;
    private String idempotencyKey;

    @Size(max = 40, message = "Reference number must be at most 40 characters")
    private String referenceNo;
}
