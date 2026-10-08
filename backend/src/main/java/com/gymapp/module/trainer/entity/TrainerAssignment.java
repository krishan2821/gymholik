package com.gymapp.module.trainer.entity;

import com.gymapp.common.TenantDocument;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;

@Document(collection = "trainer_assignments")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@CompoundIndexes({
        @CompoundIndex(name = "gym_trainer_status_idx", def = "{'gymId': 1, 'trainerId': 1, 'status': 1}"),
        @CompoundIndex(name = "gym_member_status_idx", def = "{'gymId': 1, 'memberId': 1, 'status': 1}"),
        @CompoundIndex(name = "gym_trainer_member_idx", def = "{'gymId': 1, 'trainerId': 1, 'memberId': 1}"),
        @CompoundIndex(name = "gym_trainer_member_status_idx", def = "{'gymId': 1, 'trainerId': 1, 'memberId': 1, 'status': 1}"),
        @CompoundIndex(name = "gym_created_idx", def = "{'gymId': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "gym_trainer_member_active_unique", def = "{'gymId': 1, 'trainerId': 1, 'memberId': 1}", partialFilter = "{'status': 'ACTIVE'}", unique = true)
})
public class TrainerAssignment extends TenantDocument {
    private String trainerId;
    private String memberId;
    private String status; // ACTIVE, ENDED
    private LocalDate startDate;
    private LocalDate endDate;
    private String assignedBy;
    private String endedBy;
    private Long ptFeePaise;
    private Integer sessionsTotal;
    private String notes;
}
