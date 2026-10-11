package com.gymapp.module.auth.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.auth.dto.CreateStaffRequest;
import com.gymapp.module.auth.dto.StaffResponse;
import com.gymapp.module.auth.dto.UpdateStaffRequest;
import com.gymapp.module.auth.service.AuthService;
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
@RequestMapping("/api/staff")
@RequiredArgsConstructor
@Tag(name = "Staff", description = "Staff account management — OWNER only")
@SecurityRequirement(name = "Bearer Auth")
public class StaffController {

    private final AuthService authService;

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    @Operation(
        summary = "Create a staff account",
        description = "Creates a new ACTIVE STAFF user scoped to the caller's gym (gymId from JWT only). Requires OWNER role."
    )
    public ResponseEntity<ApiResponse<StaffResponse>> createStaff(
            @Valid @RequestBody CreateStaffRequest request) {

        StaffResponse response = authService.createStaff(request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Staff account created successfully", response));
    }

    @GetMapping
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "List staff accounts", description = "OWNER only")
    public ResponseEntity<ApiResponse<List<StaffResponse>>> listStaff() {
        return ResponseEntity.ok(ApiResponse.success("Staff fetched successfully", authService.getStaffList()));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(
        summary = "Update staff account (deactivate/reactivate, name, phone)",
        description = "Deactivates or reactivates a staff account in the owner's gym. Deactivating bumps tokenVersion and invalidates sessions."
    )
    public ResponseEntity<ApiResponse<StaffResponse>> patchStaff(
            @PathVariable String id,
            @RequestBody UpdateStaffRequest request) {
        StaffResponse response = authService.updateStaff(id, request);
        return ResponseEntity.ok(ApiResponse.success("Staff account updated successfully", response));
    }
}
