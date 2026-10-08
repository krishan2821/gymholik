package com.gymapp.module.trainer.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class ApproveTrainerRequest {
    @NotEmpty(message = "At least one trainer type must be assigned")
    private List<String> trainerTypeIds;
}
