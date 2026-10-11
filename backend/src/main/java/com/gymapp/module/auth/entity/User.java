package com.gymapp.module.auth.entity;

import com.gymapp.common.TenantDocument;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "users")
@CompoundIndexes({
    @CompoundIndex(name = "gym_role_idx", def = "{'gymId': 1, 'role': 1}"),
    @CompoundIndex(name = "gym_role_status_idx", def = "{'gymId': 1, 'role': 1, 'status': 1}")
})
@Getter @Setter @SuperBuilder @NoArgsConstructor @AllArgsConstructor
public class User extends TenantDocument {

    public enum UserStatus {
        ACTIVE,
        INACTIVE
    }

    private String name;
    @Indexed(unique = true)
    private String phone;
    private String email;
    private String role;
    private boolean active;
    private String status; // ACTIVE, INACTIVE
    private java.util.List<String> trainerTypeIds;
    private String refreshTokenHash;
    private int tokenVersion;
}

