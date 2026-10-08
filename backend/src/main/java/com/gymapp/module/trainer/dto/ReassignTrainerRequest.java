package com.gymapp.module.trainer.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReassignTrainerRequest {
    @NotBlank(message = "Source trainer ID is required")
    private String fromTrainerId;

    @NotBlank(message = "Destination trainer ID is required")
    private String toTrainerId;

    private String notes;
}
