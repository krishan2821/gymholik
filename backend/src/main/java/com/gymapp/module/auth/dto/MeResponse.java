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
    private String role;
    private String gymId;
    private String gymName;
    private String gymCode;
    private boolean active;
    private String status;
    private List<TrainerTypeResponse> trainerTypes;
}
