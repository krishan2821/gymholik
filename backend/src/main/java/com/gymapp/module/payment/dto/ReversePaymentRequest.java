package com.gymapp.module.payment.dto;

import com.fasterxml.jackson.annotation.JsonSetter;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReversePaymentRequest {

    @NotNull(message = "Reason code is required")
    @Builder.Default
    private ReversalReasonCode reasonCode = ReversalReasonCode.OTHER;

    @NotBlank(message = "Note is required")
    @Size(min = 5, max = 300, message = "Note must be between 5 and 300 characters")
    private String note;

    @JsonSetter("reason")
    public void setReason(String reason) {
        if (this.note == null) {
            this.note = reason;
        }
    }
}
