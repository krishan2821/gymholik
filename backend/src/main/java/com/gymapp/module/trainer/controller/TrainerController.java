package com.gymapp.module.trainer.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.trainer.dto.ApproveTrainerRequest;
import com.gymapp.module.trainer.dto.CreateTrainerRequest;
import com.gymapp.module.trainer.dto.TrainerResponse;
import com.gymapp.module.trainer.dto.UpdateTrainerRequest;
import com.gymapp.module.trainer.service.TrainerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/trainers")
@RequiredArgsConstructor
@Tag(name = "Trainers", description = "Trainer management — OWNER only")
@SecurityRequirement(name = "Bearer Auth")
public class TrainerController {

    private final TrainerService trainerService;

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    @Operation(
        summary = "Create a trainer",
        description = "Creates an ACTIVE TRAINER user in the owner's gym (gymId from JWT only) with required trainerTypeIds and optional immediate member assignments."
    )
    public ResponseEntity<ApiResponse<TrainerResponse>> createTrainer(
            @Valid @RequestBody CreateTrainerRequest request) {
        TrainerResponse response = trainerService.createTrainer(request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Trainer created successfully", response));
    }

    @GetMapping
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "List trainers", description = "List all trainers for this gym, optionally filter by status (ACTIVE or INACTIVE)")
    public ResponseEntity<ApiResponse<List<TrainerResponse>>> listTrainers(
            @RequestParam(required = false) String status) {
        List<TrainerResponse> response = trainerService.getTrainers(status);
        return ResponseEntity.ok(ApiResponse.success("Trainers fetched successfully", response));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Get trainer details by ID", description = "OWNER only")
    public ResponseEntity<ApiResponse<TrainerResponse>> getTrainerById(@PathVariable String id) {
        TrainerResponse response = trainerService.getTrainerById(id);
        return ResponseEntity.ok(ApiResponse.success("Trainer fetched successfully", response));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(
        summary = "Update trainer (name, types, phone, deactivate/reactivate)",
        description = "Updates trainer details. Changing phone or deactivating bumps tokenVersion and invalidates sessions; deactivating also ends all active assignments."
    )
    public ResponseEntity<ApiResponse<TrainerResponse>> patchTrainer(
            @PathVariable String id,
            @RequestBody UpdateTrainerRequest request) {
        TrainerResponse response = trainerService.updateTrainer(id, request);
        return ResponseEntity.ok(ApiResponse.success("Trainer updated successfully", response));
    }

    @PutMapping("/{id}/types")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Update trainer types", description = "Change the assigned trainer types for a trainer")
    public ResponseEntity<ApiResponse<TrainerResponse>> updateTrainerTypes(
            @PathVariable String id,
            @Valid @RequestBody ApproveTrainerRequest request) {
        TrainerResponse response = trainerService.updateTrainerTypes(id, request.getTrainerTypeIds());
        return ResponseEntity.ok(ApiResponse.success("Trainer types updated successfully", response));
    }

    @PutMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Deactivate trainer", description = "Deactivates trainer, invalidates tokens, and auto-ends all active assignments")
    public ResponseEntity<ApiResponse<TrainerResponse>> deactivateTrainer(@PathVariable String id) {
        TrainerResponse response = trainerService.deactivateTrainer(id);
        return ResponseEntity.ok(ApiResponse.success("Trainer deactivated successfully", response));
    }
}
