package com.gymapp.module.auth.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.auth.dto.CollectionInfoResponse;
import com.gymapp.module.auth.dto.GymProfileResponse;
import com.gymapp.module.auth.dto.GymSettingsRequest;
import com.gymapp.module.auth.dto.UpdateCollectionInfoRequest;
import com.gymapp.module.auth.dto.UpdateGymProfileRequest;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.service.GymSettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/gym")
@RequiredArgsConstructor
@Tag(name = "Gym Settings", description = "Gym settings and profile for Owner")
@SecurityRequirement(name = "Bearer Auth")
public class GymSettingsController {

    private final GymSettingsService gymSettingsService;

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

    @GetMapping("/collection-info")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Get gym UPI collection info (OWNER and STAFF only)")
    public ResponseEntity<ApiResponse<CollectionInfoResponse>> getCollectionInfo() {
        CollectionInfoResponse info = gymSettingsService.getCollectionInfo();
        return ResponseEntity.ok(ApiResponse.success("Collection info fetched", info));
    }

    @PutMapping("/collection-info")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Update gym UPI collection info (OWNER only)")
    public ResponseEntity<ApiResponse<CollectionInfoResponse>> updateCollectionInfo(
            @Valid @RequestBody UpdateCollectionInfoRequest request) {
        CollectionInfoResponse info = gymSettingsService.updateCollectionInfo(request);
        return ResponseEntity.ok(ApiResponse.success("Collection info updated", info));
    }

    @GetMapping("/profile")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Get gym profile (OWNER only)")
    public ResponseEntity<ApiResponse<GymProfileResponse>> getGymProfile(
            @RequestParam(name = "reveal", defaultValue = "false") boolean reveal) {
        GymProfileResponse profile = gymSettingsService.getGymProfile(reveal);
        return ResponseEntity.ok(ApiResponse.success("Gym profile fetched", profile));
    }

    @PutMapping("/profile")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Update gym profile (OWNER only)")
    public ResponseEntity<ApiResponse<GymProfileResponse>> updateGymProfile(
            @Valid @RequestBody UpdateGymProfileRequest request) {
        GymProfileResponse updatedProfile = gymSettingsService.updateGymProfile(request);
        return ResponseEntity.ok(ApiResponse.success("Gym profile updated", updatedProfile));
    }
}
