package com.gymapp.module.trainer.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.trainer.dto.ApproveTrainerRequest;
import com.gymapp.module.trainer.dto.TrainerResponse;
import com.gymapp.module.trainer.service.TrainerService;
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
@RequestMapping("/api/trainers")
@RequiredArgsConstructor
@Tag(name = "Trainers", description = "Trainer management and approval — OWNER only")
@SecurityRequirement(name = "bearerAuth")
public class TrainerController {

    private final TrainerService trainerService;

    @GetMapping
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "List trainers", description = "List all trainers for this gym, optionally filter by status")
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

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Approve pending trainer", description = "Approve pending trainer and assign required trainer types")
    public ResponseEntity<ApiResponse<TrainerResponse>> approveTrainer(
            @PathVariable String id,
            @Valid @RequestBody ApproveTrainerRequest request) {
        TrainerResponse response = trainerService.approveTrainer(id, request);
        return ResponseEntity.ok(ApiResponse.success("Trainer approved successfully", response));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Reject pending trainer", description = "Reject trainer registration and auto-end assignments")
    public ResponseEntity<ApiResponse<TrainerResponse>> rejectTrainer(@PathVariable String id) {
        TrainerResponse response = trainerService.rejectTrainer(id);
        return ResponseEntity.ok(ApiResponse.success("Trainer rejected successfully", response));
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
    @Operation(summary = "Deactivate trainer", description = "Deactivates trainer and auto-ends all active assignments")
    public ResponseEntity<ApiResponse<TrainerResponse>> deactivateTrainer(@PathVariable String id) {
        TrainerResponse response = trainerService.deactivateTrainer(id);
        return ResponseEntity.ok(ApiResponse.success("Trainer deactivated successfully", response));
    }
}
