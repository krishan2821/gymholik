package com.gymapp.common;

import lombok.Builder;
import lombok.Data;

import java.util.List;

/**
 * Generic paginated response wrapper.
 * Used by list endpoints that support pagination.
 */
@Data
@Builder
public class PagedResponse<T> {
    private List<T>  content;
    private int      page;
    private int      size;
    private long     totalElements;
    private int      totalPages;
    private boolean  last;

    public static <T> PagedResponse<T> from(org.springframework.data.domain.Page<T> page) {
        return PagedResponse.<T>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}
