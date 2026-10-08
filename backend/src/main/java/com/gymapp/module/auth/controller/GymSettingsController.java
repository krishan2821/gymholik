package com.gymapp.module.auth.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.auth.dto.ChangePasswordRequest;
import com.gymapp.module.auth.dto.GymSettingsRequest;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.service.AuthService;
import com.gymapp.module.auth.service.GymSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/gym")
@RequiredArgsConstructor
@Tag(name = "Gym Settings", description = "Gym settings for Owner")
@SecurityRequirement(name = "bearerAuth")
public class GymSettingsController {

    private final GymSettingsService gymSettingsService;
    private final AuthService authService;

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Get current gym details & subscription info")
    public ResponseEntity<ApiResponse<Gym>> getGymSettings() {
        Gym gym = gymSettingsService.getGymSettings();
        return ResponseEntity.ok(ApiResponse.success("Gym details fetched", gym));
    }

    @PutMapping
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Update gym settings")
    public ResponseEntity<ApiResponse<Gym>> updateGymSettings(@Valid @RequestBody GymSettingsRequest request) {
        Gym updatedGym = gymSettingsService.updateGymSettings(request);
        return ResponseEntity.ok(ApiResponse.success("Gym settings updated", updatedGym));
    }

    @PutMapping("/password")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Change OWNER password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal String userId) {
        authService.changePassword(userId, request);
        return ResponseEntity.ok(ApiResponse.success("Password changed successfully", null));
    }
}
