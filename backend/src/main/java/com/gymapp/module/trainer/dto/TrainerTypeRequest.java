package com.gymapp.module.trainer.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TrainerTypeRequest {
    @NotBlank(message = "Type name is required")
    private String name;
    private Boolean active = true;
}
