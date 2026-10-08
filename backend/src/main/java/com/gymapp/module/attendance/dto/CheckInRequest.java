package com.gymapp.module.attendance.dto;

import lombok.Data;

@Data
public class CheckInRequest {
    // Exactly one of memberId or memberCode must be provided.
    private String memberId;
    private String memberCode;
}
