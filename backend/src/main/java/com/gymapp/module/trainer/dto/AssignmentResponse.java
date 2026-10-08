package com.gymapp.module.trainer.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AssignmentResponse {
    private String id;
    private String gymId;
    private String trainerId;
    private String trainerName;
    private String memberId;
    private String memberName;
    private String memberCode;
    private String memberPhone;
    private String status;
    private LocalDate startDate;
    private LocalDate endDate;
    private String assignedBy;
    private String endedBy;
    private Long ptFeePaise;
    private Integer sessionsTotal;
    private String notes;
    private LocalDateTime createdAt;
}
