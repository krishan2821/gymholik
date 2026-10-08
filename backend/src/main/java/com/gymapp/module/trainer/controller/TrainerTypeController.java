package com.gymapp.module.trainer.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.trainer.dto.TrainerTypeRequest;
import com.gymapp.module.trainer.dto.TrainerTypeResponse;
import com.gymapp.module.trainer.service.TrainerTypeService;
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
@RequestMapping("/api/trainer-types")
@RequiredArgsConstructor
@Tag(name = "Trainer Types", description = "Owner-managed trainer types and categories")
@SecurityRequirement(name = "bearerAuth")
public class TrainerTypeController {

    private final TrainerTypeService trainerTypeService;

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Create a trainer type", description = "OWNER only")
    public ResponseEntity<ApiResponse<TrainerTypeResponse>> create(
            @Valid @RequestBody TrainerTypeRequest request) {
        TrainerTypeResponse response = trainerTypeService.createTrainerType(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Trainer type created successfully", response));
    }

    @GetMapping
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "List all trainer types", description = "OWNER only")
    public ResponseEntity<ApiResponse<List<TrainerTypeResponse>>> list(
            @RequestParam(required = false) Boolean activeOnly) {
        List<TrainerTypeResponse> response = trainerTypeService.getTrainerTypes(activeOnly);
        return ResponseEntity.ok(ApiResponse.success("Trainer types fetched successfully", response));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Get trainer type by ID", description = "OWNER only")
    public ResponseEntity<ApiResponse<TrainerTypeResponse>> getById(@PathVariable String id) {
        TrainerTypeResponse response = trainerTypeService.getTrainerTypeById(id);
        return ResponseEntity.ok(ApiResponse.success("Trainer type fetched successfully", response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Update a trainer type", description = "OWNER only")
    public ResponseEntity<ApiResponse<TrainerTypeResponse>> update(
            @PathVariable String id,
            @Valid @RequestBody TrainerTypeRequest request) {
        TrainerTypeResponse response = trainerTypeService.updateTrainerType(id, request);
        return ResponseEntity.ok(ApiResponse.success("Trainer type updated successfully", response));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Deactivate/delete a trainer type", description = "OWNER only")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        trainerTypeService.deleteTrainerType(id);
        return ResponseEntity.ok(ApiResponse.success("Trainer type deactivated successfully"));
    }
}
