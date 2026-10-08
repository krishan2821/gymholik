package com.gymapp.module.member.service;

import com.gymapp.module.member.entity.SequenceCounter;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SequenceService {

    private final MongoTemplate mongoTemplate;

    public String generateNextMemberCode(String gymId) {
        Query query = new Query(Criteria.where("_id").is(gymId));
        Update update = new Update().inc("sequence", 1);
        FindAndModifyOptions options = new FindAndModifyOptions().returnNew(true).upsert(true);

        SequenceCounter counter = mongoTemplate.findAndModify(
                query, update, options, SequenceCounter.class);

        long seq = counter != null ? counter.getSequence() : 1;
        // Format as GYM-0001
        return String.format("GYM-%04d", seq);
    }

    public String generateNextReceiptNo(String gymId) {
        Query query = new Query(Criteria.where("_id").is(gymId));
        Update update = new Update().inc("receiptSequence", 1);
        FindAndModifyOptions options = new FindAndModifyOptions().returnNew(true).upsert(true);

        SequenceCounter counter = mongoTemplate.findAndModify(
                query, update, options, SequenceCounter.class);

        long seq = counter != null ? counter.getReceiptSequence() : 1;
        // Format as RCPT-000001
        return String.format("RCPT-%06d", seq);
    }
}
