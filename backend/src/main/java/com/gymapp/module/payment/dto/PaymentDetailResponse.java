package com.gymapp.module.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentDetailResponse {
    private String id;
    private String receiptNo;
    private String gymId;
    private String memberId;
    private String memberName;
    private String memberCode;
    private String membershipId;
    private String planName;
    private long amountPaise;
    private String mode;
    private String type;
    private LocalDateTime paidAt;
    private LocalDateTime createdAt;
    private String collectedByName;
    private String collectedByUserId;
    private String referenceNo;
    private String reason;
    private String note;

    private MembershipSummary membershipSummary;

    private String reversalOfId;
    private String reversalOfReceiptNo;
    private String reversedByPaymentId;
    private String reversalReceiptNo;
    private LocalDateTime reversedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MembershipSummary {
        private String id;
        private String planName;
        private long totalPaise;
        private long discountPaise;
        private long paidPaise;
        private long duePaise;
        private LocalDate startDate;
        private LocalDate expiryDate;
        private String status;
    }
}
