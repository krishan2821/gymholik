package com.gymapp.module.payment.entity;

import com.gymapp.common.TenantDocument;
import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

import lombok.experimental.SuperBuilder;

@Document(collection = "payments")
@CompoundIndexes({
    @CompoundIndex(name = "gymId_receiptNo_idx", def = "{'gymId': 1, 'receiptNo': 1}", unique = true),
    @CompoundIndex(name = "gymId_idempotency_idx", def = "{'gymId': 1, 'idempotencyKey': 1}", unique = true, sparse = true),
    @CompoundIndex(name = "gymId_paidAt_idx", def = "{'gymId': 1, 'paidAt': -1}"),
    @CompoundIndex(name = "gymId_createdAt_idx", def = "{'gymId': 1, 'createdAt': -1}")
})
@Getter @Setter @SuperBuilder @NoArgsConstructor @AllArgsConstructor
public class Payment extends TenantDocument {
    private String memberId;
    private String membershipId;
    private String memberName;
    private long amountPaise;
    private String mode; // CASH/UPI/CARD
    private String type; // PAYMENT/REVERSAL
    private String reversalOfId;
    private String reason;
    private String receiptNo;
    private LocalDateTime paidAt;
    private String receivedBy;
    private String note;
    private String idempotencyKey;
}
