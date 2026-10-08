package com.gymapp.module.trainer.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MemberNoteResponse {
    private String id;
    private String memberId;
    private String trainerId;
    private String trainerName;
    private String type;
    private String text;
    private Double weightKg;
    private Map<String, Object> bodyMeasurements;
    private LocalDateTime createdAt;
}
