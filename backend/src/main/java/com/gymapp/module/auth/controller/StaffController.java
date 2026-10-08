package com.gymapp.module.auth.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.auth.dto.CreateStaffRequest;
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
        description = "Creates a new STAFF user scoped to the caller's gym. "
                    + "gymId is taken from the JWT — never from the request body. "
                    + "Requires OWNER role."
    )
    public ResponseEntity<ApiResponse<Void>> createStaff(
            @Valid @RequestBody CreateStaffRequest request) {

        authService.createStaff(request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Staff account created successfully"));
    }

    @GetMapping
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "List staff accounts", description = "OWNER only")
    public ResponseEntity<ApiResponse<java.util.List<com.gymapp.module.auth.dto.StaffResponse>>> listStaff() {
        return ResponseEntity.ok(ApiResponse.success("Staff fetched successfully", authService.getStaffList()));
    }
}
