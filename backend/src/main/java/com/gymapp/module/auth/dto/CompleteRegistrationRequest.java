package com.gymapp.module.auth.dto;

import com.gymapp.module.auth.entity.GymType;
import com.gymapp.module.auth.entity.LegalIdType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request body for POST /api/auth/complete-registration.
 * Phone is never accepted from the request body — it is extracted strictly
 * from the verified REGISTER-scoped JWT.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompleteRegistrationRequest {

    @NotBlank(message = "Gym name is required")
    @Size(min = 2, max = 80, message = "Gym name must be 2–80 characters")
    private String gymName;

    @NotNull(message = "Gym type is required")
    private GymType gymType;

    @NotBlank(message = "Owner name is required")
    @Size(min = 2, max = 80, message = "Owner name must be 2–80 characters")
    private String ownerName;

    @Email(message = "Enter a valid email address")
    @Size(max = 150, message = "Email must be at most 150 characters")
    private String email;

    private LegalIdType legalIdType;

    private String legalIdNumber;

    @NotNull(message = "Address is required")
    @Valid
    private AddressDto address;

    @AssertTrue(message = "You must accept the terms and conditions")
    private boolean acceptedTerms;

    @NotBlank(message = "Terms version is required")
    private String termsVersion;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AddressDto {
        @NotBlank(message = "Line 1 is required")
        @Size(min = 5, max = 120, message = "Line 1 must be 5–120 characters")
        private String line1;

        private String line2;

        @NotBlank(message = "State is required")
        private String state;

        @NotBlank(message = "District is required")
        @Size(max = 80, message = "District must be at most 80 characters")
        private String district;

        @Pattern(regexp = "^[1-9][0-9]{5}$", message = "Pincode must be a valid 6-digit Indian PIN code")
        private String pincode;
    }
}
