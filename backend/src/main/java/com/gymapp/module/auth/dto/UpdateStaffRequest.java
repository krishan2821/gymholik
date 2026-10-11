package com.gymapp.module.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = "phone")
public class UpdateStaffRequest {

    private String name;

    private String phone;

    private Boolean active;

    private String status; // ACTIVE or INACTIVE
}
