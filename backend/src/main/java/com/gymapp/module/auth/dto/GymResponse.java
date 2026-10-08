package com.gymapp.module.auth.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class GymResponse {
    private String        gymId;
    private String        gymName;
    private String        gymCode;       // the code staff use to log in
    private String        ownerName;
    private String        ownerPhone;
    private LocalDateTime trialEndsAt;
}
