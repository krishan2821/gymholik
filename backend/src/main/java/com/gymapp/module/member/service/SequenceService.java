package com.gymapp.module.member.service;

import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.member.entity.SequenceCounter;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

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
        String prefix = resolvePrefix(gymId, "GYM");
        return String.format("%s-%04d", prefix, seq);
    }

    public String generateNextReceiptNo(String gymId) {
        Query query = new Query(Criteria.where("_id").is(gymId));
        Update update = new Update().inc("receiptSequence", 1);
        FindAndModifyOptions options = new FindAndModifyOptions().returnNew(true).upsert(true);

        SequenceCounter counter = mongoTemplate.findAndModify(
                query, update, options, SequenceCounter.class);

        long seq = counter != null ? counter.getReceiptSequence() : 1;
        String prefix = resolvePrefix(gymId, "RCPT");
        return String.format("%s-%06d", prefix, seq);
    }

    private String resolvePrefix(String gymId, String defaultPrefix) {
        if (!StringUtils.hasText(gymId)) {
            return defaultPrefix;
        }
        Gym gym = mongoTemplate.findById(gymId, Gym.class);
        if (gym != null && StringUtils.hasText(gym.getGymCode())) {
            return gym.getGymCode();
        }
        return defaultPrefix;
    }
}
