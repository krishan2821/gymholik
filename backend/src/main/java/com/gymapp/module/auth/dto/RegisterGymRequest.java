package com.gymapp.module.auth.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class RegisterGymRequest {

    @NotBlank(message = "Gym name is required")
    @Size(min = 2, max = 100, message = "Gym name must be 2–100 characters")
    private String gymName;

    @NotBlank(message = "Owner name is required")
    @Size(min = 2, max = 100, message = "Your name must be 2–100 characters")
    private String ownerName;

    /**
     * The owner's mobile number — used as both their login phone and the gym
     * contact number (gymPhone has been removed; ownerPhone covers both roles).
     */
    @NotBlank(message = "Mobile number is required")
    @Pattern(regexp = "^[6-9]\\d{9}$", message = "Enter a valid 10-digit mobile number")
    private String ownerPhone;

    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 72, message = "Password must be at least 8 characters")
    private String password;

    /** Optional. City or area of the gym. */
    @Size(max = 100, message = "City name too long")
    private String city;
}
