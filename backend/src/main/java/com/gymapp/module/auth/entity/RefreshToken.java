package com.gymapp.module.auth.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Opaque refresh token stored in MongoDB.
 * The token value is a random UUID — nothing sensitive is embedded.
 *
 * Rotation: on every /refresh call, the old token is deleted and a new one issued.
 * This gives us single-use semantics, preventing token replay.
 *
 * Indexes:
 *  - token  (unique) — fast lookup on refresh
 *  - userId           — fast bulk-delete on logout / deactivation
 */
@Document(collection = "refresh_tokens")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RefreshToken {

    @Id
    private String id;

    @Indexed(unique = true)
    private String token;     // opaque UUID

    @Indexed
    private String userId;

    private String gymId;

    private LocalDateTime expiresAt;

    private LocalDateTime createdAt;

    /** Returns true if the token is past its expiry date. */
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }
}
