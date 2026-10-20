package com.gymapp.module.member.job;

import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.service.MembershipLedgerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class MembershipStatusJob {

    private final MongoTemplate mongoTemplate;
    private final MembershipLedgerService membershipLedgerService;
    private final Clock clock;

    record MemberTenantKey(String gymId, String memberId) {}

    @Scheduled(cron = "0 5 0 * * ?", zone = "Asia/Kolkata")
    public void runDailyStatusMaintenance() {
        log.info("Starting daily membership status maintenance job at 00:05 IST...");
        maintainMembershipStatuses();
        log.info("Finished daily membership status maintenance job.");
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        log.info("Running membership status maintenance on application startup...");
        maintainMembershipStatuses();
    }

    public int maintainMembershipStatuses() {
        LocalDate today = LocalDate.now(clock);

        // Find memberships that should transition from UPCOMING to ACTIVE (startDate <= today)
        Query upcomingQuery = new Query(Criteria.where("status").is(Membership.MembershipStatus.UPCOMING.name())
                .and("startDate").lte(today));
        List<Membership> upcomingToActivate = mongoTemplate.find(upcomingQuery, Membership.class);

        // Find memberships that should transition from ACTIVE to EXPIRED (expiryDate < today)
        Query activeQuery = new Query(Criteria.where("status").is(Membership.MembershipStatus.ACTIVE.name())
                .and("expiryDate").lt(today));
        List<Membership> activeToExpire = mongoTemplate.find(activeQuery, Membership.class);

        Set<MemberTenantKey> affectedMembers = new HashSet<>();
        for (Membership m : upcomingToActivate) {
            if (m.getGymId() != null && m.getMemberId() != null) {
                affectedMembers.add(new MemberTenantKey(m.getGymId(), m.getMemberId()));
            }
        }
        for (Membership m : activeToExpire) {
            if (m.getGymId() != null && m.getMemberId() != null) {
                affectedMembers.add(new MemberTenantKey(m.getGymId(), m.getMemberId()));
            }
        }

        for (MemberTenantKey key : affectedMembers) {
            try {
                membershipLedgerService.recalculate(key.gymId(), key.memberId());
            } catch (Exception e) {
                log.error("Failed to recalculate status for member {} in gym {}", key.memberId(), key.gymId(), e);
            }
        }

        log.info("Membership status maintenance processed: {} upcoming to activate, {} active to expire across {} members",
                upcomingToActivate.size(), activeToExpire.size(), affectedMembers.size());

        return affectedMembers.size();
    }
}
