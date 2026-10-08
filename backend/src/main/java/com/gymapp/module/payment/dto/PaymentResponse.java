package com.gymapp.module.payment.dto;


import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class PaymentResponse {
    private String id;
    private String gymId;
    private String memberId;
    private String memberName;
    private String membershipId;
    private long amountPaise;
    private String mode;
    private LocalDateTime paidAt;
    private String receiptNo;
    private String type;
    private String reversalOfId;
    private String reason;
    private LocalDateTime createdAt;
}
