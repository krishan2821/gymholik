package com.gymapp.module.member.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDate;

@Data
public class RenewMembershipRequest {

    @NotBlank(message = "Plan ID is required for renewal")
    private String planId;

    // Optional: if not provided, defaults to continuous renewal (expiry of previous + 1 day, or today if expired)
    private LocalDate startDate;
}
