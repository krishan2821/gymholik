package com.gymapp.module.attendance.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
@Builder
public class AttendanceRecordResponse {
    private String id;
    private String memberId;
    private String memberName;
    private String memberCode;
    private LocalDate date;
    private LocalTime checkInTime;
}
