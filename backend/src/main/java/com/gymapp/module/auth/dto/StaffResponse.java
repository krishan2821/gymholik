package com.gymapp.module.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffResponse {
    private String id;
    private String gymId;
    private String name;
    private String phone;
    private String role;
    private boolean active;
    private String status;
    private LocalDateTime createdAt;
}
