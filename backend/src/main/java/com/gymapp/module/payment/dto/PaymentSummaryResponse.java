package com.gymapp.module.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentSummaryResponse {
    private long collectedPaise;
    private long count;
    private Map<String, ModeSummary> byMode;
    private Long previousPeriodPaise;
    private Double percentChange;
    private long pendingDuePaise;
    private long pendingMembersCount;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ModeSummary {
        private long paise;
        private double percent;
    }
}
