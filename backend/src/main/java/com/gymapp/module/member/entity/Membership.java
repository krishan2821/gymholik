package com.gymapp.module.member.entity;

import com.gymapp.common.TenantDocument;
import lombok.*;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;

import lombok.experimental.SuperBuilder;

@Document(collection = "memberships")
@Getter @Setter @SuperBuilder @NoArgsConstructor @AllArgsConstructor
public class Membership extends TenantDocument {

    public enum MembershipStatus {
        ACTIVE, EXPIRED
    }

    private String memberId;
    private String planId;
    private String planName;
    private LocalDate startDate;
    private LocalDate expiryDate;
    private long totalPaise;
    private long paidPaise;
    private long duePaise;
    private MembershipStatus status;
}
