package com.gymapp.module.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GymSettingsRequest {
    @NotBlank
    private String name;
    
    private String address;
    private String logoUrl;
    private boolean allowExpiredCheckin;
    private int reminderDaysBefore;
    private Boolean staffCanSeeFullPhone;
}
