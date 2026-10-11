package com.gymapp.module.auth.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.auth.dto.*;
import com.gymapp.module.auth.service.AuthService;
import com.gymapp.module.auth.service.OtpService;
import com.gymapp.security.ClientIpResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "Auth", description = "OTP authentication, gym-owner registration, and token management")
public class AuthController {

    private final AuthService authService;
    private final OtpService otpService;
    private final ClientIpResolver clientIpResolver;

    @PostMapping("/send-otp")
    @Operation(
        summary = "Send OTP to mobile number",
        description = "Sends a 6-digit OTP to an Indian mobile number. Always returns the same response regardless of whether the phone is registered."
    )
    public ResponseEntity<ApiResponse<SendOtpResponse>> sendOtp(
            @Valid @RequestBody SendOtpRequest request,
            HttpServletRequest httpServletRequest) {
        String ip = clientIpResolver != null
                ? clientIpResolver.resolveClientIp(httpServletRequest)
                : httpServletRequest.getRemoteAddr();
        SendOtpResponse response = otpService.sendOtp(request, ip);
        return ResponseEntity.ok(ApiResponse.success("OTP sent", response));
    }

    @PostMapping("/verify-otp")
    @Operation(
        summary = "Verify OTP",
        description = "Verifies the 6-digit OTP. Issues access + refresh tokens for existing active users, or a short-lived REGISTER-scoped token for new users."
    )
    public ResponseEntity<ApiResponse<VerifyOtpResponse>> verifyOtp(
            @Valid @RequestBody VerifyOtpRequest request) {
        VerifyOtpResponse response = otpService.verifyOtp(request);
        String message = response.isNewUser() ? "Verified" : "Authentication successful";
        return ResponseEntity.ok(ApiResponse.success(message, response));
    }

    @PostMapping("/complete-registration")
    @SecurityRequirement(name = "Bearer Auth")
    @Operation(
        summary = "Complete gym-owner registration",
        description = "Requires a single-use registrationToken (scope REGISTER). Phone comes strictly from the token. "
                    + "Creates the Gym (14-day TRIAL, default plans, default trainer types) and the OWNER user (ACTIVE) in one transaction, "
                    + "then returns accessToken, refreshToken, and user."
    )
    public ResponseEntity<ApiResponse<VerifyOtpResponse>> completeRegistration(
            @Valid @RequestBody CompleteRegistrationRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null || "anonymousUser".equals(auth.getPrincipal())) {
            throw new AppException(ErrorCode.UNAUTHORIZED, "Full authentication is required");
        }
        String phone = (String) auth.getPrincipal();
        String registrationToken = auth.getCredentials() instanceof String s ? s : null;

        VerifyOtpResponse response = authService.completeRegistration(phone, registrationToken, request);
        return ResponseEntity.ok(ApiResponse.success("Authentication successful", response));
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
    @SecurityRequirement(name = "Bearer Auth")
    @Operation(
        summary = "Get current logged-in user profile",
        description = "Returns current user name, phone, email, role, gym details, and trainer types"
    )
    public ResponseEntity<ApiResponse<MeResponse>> getMe() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null || "anonymousUser".equals(auth.getPrincipal())) {
            throw new AppException(ErrorCode.UNAUTHORIZED, "Full authentication is required");
        }
        String userId = (String) auth.getPrincipal();
        MeResponse me = authService.getMe(userId);
        return ResponseEntity.ok(ApiResponse.success("Profile fetched", me));
    }

    @PutMapping("/me")
    @SecurityRequirement(name = "Bearer Auth")
    @Operation(
        summary = "Update current user profile",
        description = "Updates user's own name and phone number"
    )
    public ResponseEntity<ApiResponse<MeResponse>> updateMe(
            @RequestBody UpdateMeRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null || "anonymousUser".equals(auth.getPrincipal())) {
            throw new AppException(ErrorCode.UNAUTHORIZED, "Full authentication is required");
        }
        String userId = (String) auth.getPrincipal();
        MeResponse me = authService.updateMe(userId, request);
        return ResponseEntity.ok(ApiResponse.success("Profile updated", me));
    }
}
