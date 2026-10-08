package com.gymapp.module.trainer.entity;

import com.gymapp.common.TenantDocument;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "trainer_types")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(name = "gym_name_unique_idx", def = "{'gymId': 1, 'name': 1}", unique = true),
        @CompoundIndex(name = "gym_active_idx", def = "{'gymId': 1, 'active': 1}")
})
public class TrainerType extends TenantDocument {
    private String name;
    private boolean active;
}
