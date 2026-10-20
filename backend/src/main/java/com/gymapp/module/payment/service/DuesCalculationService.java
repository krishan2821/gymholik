package com.gymapp.module.payment.service;

import com.gymapp.module.member.entity.Membership;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class DuesCalculationService {

    private final MongoTemplate mongoTemplate;

    public record PendingDuesSummary(long totalDuePaise, long membersCount) {}

    /**
     * Recomputes pending dues and affected member counts directly from memberships with duePaise > 0.
     * Used identically by Payments Summary and Dashboard Total Due.
     */
    public PendingDuesSummary getPendingDuesSummary(String gymId) {
        Query query = new Query(Criteria.where("gymId").is(gymId).and("duePaise").gt(0));
        List<Membership> mems = mongoTemplate.find(query, Membership.class);
        long totalDue = mems.stream().mapToLong(Membership::getDuePaise).sum();
        long count = mems.stream().map(Membership::getMemberId).filter(Objects::nonNull).distinct().count();
        return new PendingDuesSummary(totalDue, count);
    }
}
