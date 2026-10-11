package com.gymapp.module.auth.dto;

import com.gymapp.module.trainer.dto.TrainerTypeResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MeResponse {
    private String id;
    private String userId;
    private String name;
    private String phone;
    private String email;
    private String role;
    private String gymId;
    private String gymName;
    private String gymType;
    private String gymCode;
    private GymSummary gym;
    private boolean active;
    private String status;
    private List<TrainerTypeResponse> trainerTypes;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public static class GymSummary {
        private String id;
        private String name;
        private String gymType;
        private String gymCode;
    }
}
