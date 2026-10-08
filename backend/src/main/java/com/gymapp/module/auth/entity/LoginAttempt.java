package com.gymapp.module.auth.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Tracks consecutive failed login attempts per (gymId + phone) key.
 *
 * Lockout logic:
 *  - After {@code maxAttempts} failures, lockedUntil is set to now + lockoutMinutes.
 *  - On successful login the document is deleted (reset).
 *
 * Index:
 *  - key (unique) — fast lookup; key = "<gymId>:<phone>" or "SUPER:<phone>"
 */
@Document(collection = "login_attempts")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class LoginAttempt {

    @Id
    private String id;

    /** Composite key: "<gymId>:<phone>" or "SUPER:<phone>" for SUPER_ADMIN. */
    @Indexed(unique = true)
    private String key;

    private int attemptCount;

    /** Null when not locked. Set to now+lockoutMinutes on breach. */
    private LocalDateTime lockedUntil;

    private LocalDateTime lastAttemptAt;

    /** Returns true if the account is currently within a lockout window. */
    public boolean isLocked() {
        return lockedUntil != null && LocalDateTime.now().isBefore(lockedUntil);
    }
}
