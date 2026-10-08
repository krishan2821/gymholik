package com.gymapp.module.audit.entity;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "audit_logs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(name = "gym_timestamp_idx", def = "{'gymId': 1, 'timestamp': -1}"),
        @CompoundIndex(name = "gym_action_timestamp_idx", def = "{'gymId': 1, 'action': 1, 'timestamp': -1}"),
        @CompoundIndex(name = "gym_actor_timestamp_idx", def = "{'gymId': 1, 'actorId': 1, 'timestamp': -1}")
})
public class AuditLog {
    @Id
    private String id;

    @Indexed
    private String gymId;

    private String actorId;

    private String actorRole;

    private String action;

    private String targetId;

    private String details;

    @CreatedDate
    private LocalDateTime timestamp;
}
