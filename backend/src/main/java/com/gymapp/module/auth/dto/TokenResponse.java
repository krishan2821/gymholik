package com.gymapp.module.auth.dto;

import lombok.Builder;
import lombok.Data;
import lombok.ToString;

@Data
@Builder
@ToString(exclude = {"accessToken", "refreshToken"})
public class TokenResponse {
    private String accessToken;
    private String refreshToken;
    private String tokenType;    // always "Bearer"
    private long   expiresIn;   // access token TTL in seconds
    private String userId;
    private String gymId;        // null for SUPER_ADMIN
    private String role;
}

