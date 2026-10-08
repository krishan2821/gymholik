package com.gymapp.module.admin.dto;

import jakarta.validation.constraints.Min;
import lombok.Data;

@Data
public class ExtendSubscriptionRequest {
    @jakarta.validation.constraints.NotBlank
    private String plan; // MONTHLY or YEARLY
}
