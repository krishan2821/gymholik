package com.gymapp.module.plan.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class PlanResponse {
    private String        id;
    private String        gymId;
    private String        name;
    private int           durationDays;
    private long          pricePaise;           // in paise
    private String        priceFormatted;  // "₹1,500.00" — pre-formatted for display
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
