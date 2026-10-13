package com.gymapp.module.payment.dto;

import com.gymapp.common.PagedResponse;
import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class PaymentListResponse {
    private PagedResponse<PaymentResponse> payments;
    private Map<String, Long> totalsByMode;
    private java.util.List<DayTotalResponse> dayTotals;

    public java.util.List<PaymentResponse> getItems() {
        return payments != null && payments.getContent() != null ? payments.getContent() : java.util.List.of();
    }
}
