package com.gymapp.module.trainer.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = "phone")
public class UpdateTrainerRequest {

    private String name;

    private String phone;

    private List<String> trainerTypeIds;

    private Boolean active;

    private String status; // ACTIVE or INACTIVE
}
