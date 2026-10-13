package com.gymapp.module.payment.dto;

import com.gymapp.module.payment.entity.DayClose;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DayCloseReportResponse {
    private LocalDate date;
    private long totalCollectedPaise;
    private long count;
    private long reversalsCount;
    private long reversalsPaise;
    private Map<String, Long> byMode;
    private long expectedCashPaise;
    private List<StaffBreakdownResponse> staffBreakdown;
    private boolean isClosed;
    private DayClose dayClose;
}
