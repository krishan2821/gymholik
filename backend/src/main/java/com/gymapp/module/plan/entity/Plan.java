package com.gymapp.module.plan.entity;

import com.gymapp.common.TenantDocument;
import lombok.*;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.experimental.SuperBuilder;

@Document(collection = "plans")
@Getter @Setter @SuperBuilder @NoArgsConstructor @AllArgsConstructor
public class Plan extends TenantDocument {
    private String name;
    private int durationDays;
    private long pricePaise;
    private boolean active;
}
