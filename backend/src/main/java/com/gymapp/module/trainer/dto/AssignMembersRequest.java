package com.gymapp.module.trainer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class AssignMembersRequest {
    @NotBlank(message = "Trainer ID is required")
    private String trainerId;

    @NotEmpty(message = "At least one member ID is required")
    private List<String> memberIds;

    private LocalDate startDate;
    private Long ptFeePaise;
    private Integer sessionsTotal;
    private String notes;
}
