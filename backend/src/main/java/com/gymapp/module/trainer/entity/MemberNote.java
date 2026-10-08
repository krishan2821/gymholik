package com.gymapp.module.trainer.entity;

import com.gymapp.common.TenantDocument;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Map;

@Document(collection = "member_notes")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(name = "gym_member_created_idx", def = "{'gymId': 1, 'memberId': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "gym_trainer_created_idx", def = "{'gymId': 1, 'trainerId': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "gym_member_type_idx", def = "{'gymId': 1, 'memberId': 1, 'type': 1}")
})
public class MemberNote extends TenantDocument {
    private String memberId;
    private String trainerId;
    private String type; // WORKOUT, DIET, PROGRESS, GENERAL
    private String text;
    private Double weightKg;
    private Map<String, Object> bodyMeasurements;
}
