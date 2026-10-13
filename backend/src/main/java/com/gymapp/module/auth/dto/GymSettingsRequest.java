package com.gymapp.module.auth.dto;

import com.gymapp.module.auth.entity.GymAddress;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GymSettingsRequest {
    @NotBlank
    private String name;
    
    private GymAddress address;
    private String logoUrl;
    private boolean allowExpiredCheckin;
    private int reminderDaysBefore;
    private Boolean staffCanSeeFullPhone;
    private String upiId;
    private String upiName;
}
