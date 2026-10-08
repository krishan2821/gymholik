package com.gymapp.module.dashboard.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;

@Data
@Builder
public class DailyCollectionResponse {
    private LocalDate date;
    private long amountPaise;
}
