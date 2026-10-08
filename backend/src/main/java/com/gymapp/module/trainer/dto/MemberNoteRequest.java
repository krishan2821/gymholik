package com.gymapp.module.trainer.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class MemberNoteRequest {
    @NotBlank(message = "Note type is required")
    private String type; // WORKOUT, DIET, PROGRESS, GENERAL

    @NotBlank(message = "Note text is required")
    private String text;

    private Double weightKg;
    private Map<String, Object> bodyMeasurements;
}
