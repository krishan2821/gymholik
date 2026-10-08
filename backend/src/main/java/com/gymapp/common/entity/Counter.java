package com.gymapp.common.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import lombok.*;

@Document(collection = "counters")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Counter {
    @Id
    private String id;
    private String gymId;
    private String sequenceName;
    private long seq;
}
