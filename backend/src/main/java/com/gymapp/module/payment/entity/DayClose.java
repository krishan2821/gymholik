package com.gymapp.module.payment.entity;

import com.gymapp.common.TenantDocument;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;

@Document(collection = "day_closes")
@CompoundIndexes({
    @CompoundIndex(name = "gymId_date_idx", def = "{'gymId': 1, 'date': 1}", unique = true)
})
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class DayClose extends TenantDocument {
    private LocalDate date;
    private long expectedCashPaise;
    private long countedCashPaise;
    private long differencePaise;
    private String closedBy;
    private String note;
}
