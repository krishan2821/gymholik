package com.gymapp.module.auth.dto;

import com.gymapp.module.auth.entity.GymType;
import com.gymapp.module.auth.entity.LegalIdType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateGymProfileRequest {
    @NotBlank(message = "Gym name is required")
    @Size(min = 2, max = 80, message = "Gym name must be 2–80 characters")
    private String name;

    @NotNull(message = "Gym type is required")
    private GymType gymType;

    private LegalIdType legalIdType;

    private String legalIdNumber;

    @NotNull(message = "Address is required")
    @Valid
    private CompleteRegistrationRequest.AddressDto address;
}
