package com.gymapp.module.attendance.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class AbsentMemberResponse {
    private String memberId;
    private String memberCode;
    private String memberName;
    private String phone;
    private LocalDate lastAttendanceDate; // Can be null if never checked in
    private long daysAbsent;
}
