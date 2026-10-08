package com.gymapp.module.notification.entity;

import com.gymapp.common.TenantDocument;
import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

import lombok.experimental.SuperBuilder;

@Document(collection = "reminder_logs")
@CompoundIndex(name = "gymId_membershipId_type_idx", def = "{'gymId': 1, 'membershipId': 1, 'type': 1}", unique = true)
@Getter @Setter @SuperBuilder @NoArgsConstructor @AllArgsConstructor
public class ReminderLog extends TenantDocument {
    private String memberId;
    private String membershipId;
    private String type; // D3/D1/D0
    private String channel;
    private LocalDateTime sentAt;
    private String status;
}
