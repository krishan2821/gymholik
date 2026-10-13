package com.gymapp.module.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DuesListResponse {
    private List<DueItemResponse> items;
    private List<DueItemResponse> content; // alias for items
    private long totalDuePaise;
    private long count;
    private int page;
    private int size;
    private long totalElements;
    private int totalPages;
    private boolean last;
}
