package com.gymapp.module.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateMemberRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "^\\d{10,15}$", message = "Phone number must be between 10 and 15 digits")
    private String phone;

    private String gender;
    private LocalDate dob;
    private String address;

    @NotBlank(message = "Plan ID is required to create a member")
    private String planId;

    // Optional: if not provided, defaults to today
    private LocalDate startDate;
}
