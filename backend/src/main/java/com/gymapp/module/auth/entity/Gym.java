package com.gymapp.module.auth.entity;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "gyms")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Gym {
    @Id
    private String id;
    private String name;
    private String ownerName;
    private String phone;
    private String address;
    private String logoUrl;
    private String gymCode;
    private String status; // TRIAL/ACTIVE/EXPIRED/SUSPENDED
    private String subscriptionPlan;
    private LocalDate subscriptionValidTill;
    private boolean allowExpiredCheckin;
    private int reminderDaysBefore;
    private boolean staffCanSeeFullPhone;
    @CreatedDate private LocalDateTime createdAt;
    @LastModifiedDate private LocalDateTime updatedAt;
    @Version private Long version;
}
