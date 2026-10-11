package com.gymapp.module.auth.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Stores OTP verification state and per-phone rate-limiting metadata.
 * Plain OTPs are never persisted — only HMAC-SHA256 hashes (peppered with OTP_PEPPER).
 * Documents automatically expire via the MongoDB TTL index on {@code expiresAt}.
 */
@Document(collection = "otp_requests")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = {"phone", "otpHash"})
public class OtpRequest {

    @Id
    private String id;

    @Indexed(unique = true, name = "otp_phone_unique_idx")
    private String phone;

    private String otpHash;

    @Indexed(name = "otp_expires_ttl_idx", expireAfterSeconds = 3600)
    private Instant expiresAt;

    private int attempts;

    private int sendCountInWindow;

    private Instant windowStart;

    private Instant lastSentAt;

    private int consecutiveInvalidations;

    private Instant blockedUntil;
}
