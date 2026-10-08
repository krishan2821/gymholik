package com.gymapp.module.auth.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.auth.dto.*;
import com.gymapp.module.auth.service.AuthService;
import com.gymapp.security.LoginRateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "Registration, login, and token management — all endpoints are public")
public class AuthController {

    private final AuthService authService;
    private final LoginRateLimiter rateLimiter;

    @PostMapping("/register-gym")
    @Operation(
        summary = "Register a new gym",
        description = "Creates a gym tenant + owner account. Starts a 14-day trial. "
                    + "Returns the gymCode that staff will use to log in."
    )
    public ResponseEntity<ApiResponse<GymResponse>> registerGym(
            @Valid @RequestBody RegisterGymRequest request) {

        GymResponse response = authService.registerGym(request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Gym registered. 14-day trial started.", response));
    }

    @PostMapping("/register-trainer")
    @Operation(
        summary = "Register as a trainer",
        description = "Creates a TRAINER account in PENDING_APPROVAL status. Requires OWNER approval before login."
    )
    public ResponseEntity<ApiResponse<Void>> registerTrainer(
            @Valid @RequestBody RegisterTrainerRequest request) {
        authService.registerTrainer(request);
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Trainer registration submitted. Awaiting gym owner approval.", null));
    }

    @PostMapping("/login")
    @Operation(
        summary = "Login",
        description = "Provide phone + password + gymCode for OWNER/STAFF. "
                    + "Leave gymCode blank for SUPER_ADMIN login."
    )
    public ResponseEntity<ApiResponse<TokenResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpServletRequest) {
            
        String ip = httpServletRequest.getRemoteAddr();
        if (!rateLimiter.isAllowed(ip)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiResponse.error("TOO_MANY_REQUESTS", "Too many login attempts from this IP. Please try again later."));
        }

        TokenResponse tokens = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success("Login successful", tokens));
    }

    @PostMapping("/refresh")
    @Operation(
        summary = "Refresh access token",
        description = "Exchanges a valid refresh token for a new access + refresh pair (rotation)."
    )
    public ResponseEntity<ApiResponse<TokenResponse>> refresh(
            @Valid @RequestBody RefreshTokenRequest request) {

        TokenResponse tokens = authService.refreshToken(request);
        return ResponseEntity.ok(ApiResponse.success("Token refreshed", tokens));
    }

    @GetMapping("/me")
    @Operation(
        summary = "Get current logged-in user profile",
        description = "Returns current user name, phone, role, gym details, and trainer types"
    )
    public ResponseEntity<ApiResponse<MeResponse>> getMe() {
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null || "anonymousUser".equals(auth.getPrincipal())) {
            throw new com.gymapp.common.exception.AppException(
                    com.gymapp.common.exception.ErrorCode.ACCESS_DENIED, "Full authentication is required");
        }
        String userId = (String) auth.getPrincipal();
        MeResponse me = authService.getMe(userId);
        return ResponseEntity.ok(ApiResponse.success("Profile fetched", me));
    }

    @PutMapping("/me")
    @Operation(
        summary = "Update current user profile",
        description = "Updates user's own name and phone number"
    )
    public ResponseEntity<ApiResponse<MeResponse>> updateMe(
            @RequestBody UpdateMeRequest request) {
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null || "anonymousUser".equals(auth.getPrincipal())) {
            throw new com.gymapp.common.exception.AppException(
                    com.gymapp.common.exception.ErrorCode.ACCESS_DENIED, "Full authentication is required");
        }
        String userId = (String) auth.getPrincipal();
        MeResponse me = authService.updateMe(userId, request);
        return ResponseEntity.ok(ApiResponse.success("Profile updated", me));
    }

    @PutMapping("/password")
    @Operation(summary = "Change password for logged-in user")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request) {
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null || "anonymousUser".equals(auth.getPrincipal())) {
            throw new com.gymapp.common.exception.AppException(
                    com.gymapp.common.exception.ErrorCode.ACCESS_DENIED, "Full authentication is required");
        }
        String userId = (String) auth.getPrincipal();
        authService.changePassword(userId, request);
        return ResponseEntity.ok(ApiResponse.success("Password changed successfully", null));
    }
}
