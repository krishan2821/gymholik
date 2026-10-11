package com.gymapp.module.auth.dto;

import com.gymapp.module.auth.entity.GymAddress;
import com.gymapp.module.auth.entity.GymType;
import com.gymapp.module.auth.entity.LegalIdType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GymProfileResponse {
    private String id;
    private String name;
    private String gymCode;
    private GymType gymType;
    private String status;
    private LocalDate subscriptionValidTill;
    private boolean legalIdVerified;
    private LegalIdType legalIdType;
    private String legalIdNumber;
    private GymAddress address;
    private String logoUrl;
    private boolean allowExpiredCheckin;
    private int reminderDaysBefore;
    private boolean staffCanSeeFullPhone;
}
