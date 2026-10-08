package com.gymapp.module.attendance.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
@Builder
public class CheckInResponse {
    private String id;
    private String memberId;
    private String memberName;
    private LocalDate date;
    private LocalTime checkInTime;
    
    // Warning flag if no active membership is found
    private boolean membershipExpiredWarning;
}
