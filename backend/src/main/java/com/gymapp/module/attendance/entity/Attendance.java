package com.gymapp.module.attendance.entity;

import com.gymapp.common.TenantDocument;
import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalTime;

import lombok.experimental.SuperBuilder;

@Document(collection = "attendances")
@CompoundIndexes({
    @CompoundIndex(name = "gymId_memberId_date_idx", def = "{'gymId': 1, 'memberId': 1, 'date': 1}", unique = true),
    @CompoundIndex(name = "gymId_date_idx", def = "{'gymId': 1, 'date': 1}"),
    @CompoundIndex(name = "gymId_date_memberId_idx", def = "{'gymId': 1, 'date': 1, 'memberId': 1}")
})
@Getter @Setter @SuperBuilder @NoArgsConstructor @AllArgsConstructor
public class Attendance extends TenantDocument {
    private String memberId;
    private String memberName;
    private LocalDate date;
    private LocalTime checkInTime;
    private String method; // MANUAL/QR
    private String markedBy;
    private boolean expiredWarning;
}
