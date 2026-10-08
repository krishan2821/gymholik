package com.gymapp.module.auth.entity;

import com.gymapp.common.TenantDocument;
import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

import lombok.experimental.SuperBuilder;

@Document(collection = "users")
@CompoundIndexes({
    @CompoundIndex(name = "gym_role_idx", def = "{'gymId': 1, 'role': 1}"),
    @CompoundIndex(name = "gym_role_status_idx", def = "{'gymId': 1, 'role': 1, 'status': 1}")
})
@Getter @Setter @SuperBuilder @NoArgsConstructor @AllArgsConstructor
public class User extends TenantDocument {
    private String name;
    @Indexed(unique = true)
    private String phone;
    private String passwordHash;
    private String role;
    private boolean active;
    private String status; // ACTIVE, PENDING_APPROVAL, REJECTED, INACTIVE
    private java.util.List<String> trainerTypeIds;
    private int failedAttempts;
    private LocalDateTime lockedUntil;
    private String refreshTokenHash;
}
