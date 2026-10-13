package com.gymapp.module.member.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.member.dto.ApplyDiscountRequest;
import com.gymapp.module.member.dto.MembershipResponse;
import com.gymapp.module.member.dto.UpdatePromisedDateRequest;
import com.gymapp.module.member.service.MemberService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/memberships")
@RequiredArgsConstructor
@Tag(name = "Memberships", description = "Membership management endpoints")
@SecurityRequirement(name = "bearerAuth")
public class MembershipController {

    private final MemberService memberService;

    @PostMapping("/{id}/discount")
    @PreAuthorize("hasRole('OWNER')")
    @Operation(summary = "Apply discount to a membership (OWNER only)")
    public ResponseEntity<ApiResponse<MembershipResponse>> applyDiscount(
            @PathVariable String id,
            @Valid @RequestBody ApplyDiscountRequest request) {
        MembershipResponse response = memberService.applyDiscount(id, request);
        return ResponseEntity.ok(ApiResponse.success("Discount applied successfully", response));
    }

    @PatchMapping("/{id}/promised-date")
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Update promised date for paying balance due (OWNER, STAFF)")
    public ResponseEntity<ApiResponse<MembershipResponse>> updatePromisedDate(
            @PathVariable String id,
            @Valid @RequestBody UpdatePromisedDateRequest request) {
        MembershipResponse response = memberService.updatePromisedDate(id, request);
        return ResponseEntity.ok(ApiResponse.success("Promised date updated successfully", response));
    }
}
