package com.gymapp.module.plan.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class PlanRequest {

    @NotBlank(message = "Plan name is required")
    @Size(min = 2, max = 100, message = "Plan name must be 2–100 characters")
    private String name;

    @Min(value = 1, message = "Duration must be at least 1 day")
    @Max(value = 3650, message = "Duration cannot exceed 3650 days (10 years)")
    private int durationDays;

    /**
     * Price in paise (smallest unit of INR).
     * Client must send rupee amount × 100. e.g. ₹1,500 → 150000.
     */
    @Min(value = 0, message = "Price cannot be negative")
    private long pricePaise;
}
