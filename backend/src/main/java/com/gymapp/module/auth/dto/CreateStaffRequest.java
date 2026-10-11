package com.gymapp.module.auth.dto;

import jakarta.validation.constraints.*;
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
public class CreateStaffRequest {

    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 100, message = "Name must be 2–100 characters")
    private String name;

    @NotBlank(message = "Phone is required")
    @Pattern(regexp = "^(\\+91[-\\s]?)?[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian mobile number")
    private String phone;
}


