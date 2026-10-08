package com.gymapp.module.plan.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.plan.dto.PlanRequest;
import com.gymapp.module.plan.dto.PlanResponse;
import com.gymapp.module.plan.service.PlanService;
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
@RequestMapping("/api/plans")
@RequiredArgsConstructor
@Tag(name = "Plans", description = "Subscription plan management")
@SecurityRequirement(name = "Bearer Auth")
public class PlanController {

    private final PlanService planService;

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Create a new subscription plan (OWNER only)")
    public ResponseEntity<ApiResponse<PlanResponse>> create(
            @Valid @RequestBody PlanRequest request) {

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Plan created", planService.createPlan(request)));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    @Operation(summary = "List all active plans for this gym")
    public ResponseEntity<ApiResponse<List<PlanResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success("Plans fetched", planService.getAllPlans()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('OWNER','STAFF')")
    @Operation(summary = "Get a plan by ID")
    public ResponseEntity<ApiResponse<PlanResponse>> getById(@PathVariable String id) {
        return ResponseEntity.ok(ApiResponse.success("Plan fetched", planService.getPlanById(id)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Update a plan (OWNER only)")
    public ResponseEntity<ApiResponse<PlanResponse>> update(
            @PathVariable String id,
            @Valid @RequestBody PlanRequest request) {

        return ResponseEntity.ok(ApiResponse.success("Plan updated", planService.updatePlan(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Soft-delete a plan (OWNER only). Existing memberships are unaffected.")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        planService.deletePlan(id);
        return ResponseEntity.ok(ApiResponse.success("Plan deleted"));
    }
}
