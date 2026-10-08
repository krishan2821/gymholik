package com.gymapp.module.trainer.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TrainerResponse {
    private String id;
    private String gymId;
    private String name;
    private String phone;
    private String role;
    private boolean active;
    private String status;
    private List<TrainerTypeResponse> trainerTypes;
    private int activeAssignmentsCount;
    private LocalDateTime createdAt;
}
