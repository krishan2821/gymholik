package com.gymapp.module.member.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Per-gym atomic sequence counter used to generate sequential member codes.
 *
 * The _id IS the gymId so we get a natural unique constraint and O(1) upsert.
 * Incremented atomically via MongoTemplate.findAndModify with $inc
 * in {@link com.gymapp.module.member.service.SequenceService}.
 */
@Document(collection = "sequence_counters")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class SequenceCounter {

    @Id
    private String gymId;   // _id = gymId

    private long sequence;  // monotonically increasing per gym

    private long receiptSequence; // monotonically increasing receipt numbers per gym
}
