package com.gymapp.module.auth.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class LoginRequest {

    @NotBlank(message = "Phone is required")
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit Indian mobile number")
    private String phone;

    @NotBlank(message = "Password is required")
    private String password;

    /**
     * Short alphanumeric code identifying the gym (e.g. "FITZON1234").
     * Leave null or blank for SUPER_ADMIN login.
     */
    private String gymCode;
}
