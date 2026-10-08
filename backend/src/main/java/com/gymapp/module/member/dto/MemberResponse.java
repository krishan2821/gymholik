package com.gymapp.module.member.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.time.LocalDate;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MemberResponse {
    private String id;
    private String gymId;
    private String memberCode;
    private String name;
    private String phone;
    private String gender;
    private LocalDate dob;
    private String address;
    private String photoUrl; // e.g. /api/members/{id}/photo
    private String status;
    private LocalDate currentExpiry;
    private long currentDuePaise;
    private LocalDate lastAttendanceDate;
    
    // Summary of current active membership if available
    private MembershipResponse currentMembership;
    
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
