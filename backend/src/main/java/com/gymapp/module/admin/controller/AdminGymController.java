package com.gymapp.module.admin.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.admin.dto.ExtendSubscriptionRequest;
import com.gymapp.module.admin.service.AdminGymService;
import com.gymapp.module.auth.entity.Gym;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/gyms")
@RequiredArgsConstructor
@Tag(name = "Super Admin", description = "Endpoints for managing gyms across the system")
@SecurityRequirement(name = "bearerAuth")
public class AdminGymController {

    private final AdminGymService adminGymService;

    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "List all registered gyms")
    public ResponseEntity<ApiResponse<List<Gym>>> listGyms() {
        List<Gym> gyms = adminGymService.getAllGyms();
        return ResponseEntity.ok(ApiResponse.success("Gyms fetched successfully", gyms));
    }

    @PostMapping("/{id}/extend")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Extend gym subscription")
    public ResponseEntity<ApiResponse<Gym>> extendSubscription(
            @PathVariable String id,
            @Valid @RequestBody ExtendSubscriptionRequest request) {
        Gym updatedGym = adminGymService.extendSubscription(id, request.getPlan());
        return ResponseEntity.ok(ApiResponse.success("Gym subscription extended successfully", updatedGym));
    }

    @PostMapping("/{id}/suspend")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Suspend a gym")
    public ResponseEntity<ApiResponse<Gym>> suspendGym(@PathVariable String id) {
        Gym updatedGym = adminGymService.suspendGym(id);
        return ResponseEntity.ok(ApiResponse.success("Gym suspended successfully", updatedGym));
    }

    @PostMapping("/{id}/reactivate")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Operation(summary = "Reactivate a suspended gym")
    public ResponseEntity<ApiResponse<Gym>> reactivateGym(@PathVariable String id) {
        Gym updatedGym = adminGymService.reactivateGym(id);
        return ResponseEntity.ok(ApiResponse.success("Gym reactivated successfully", updatedGym));
    }
}
