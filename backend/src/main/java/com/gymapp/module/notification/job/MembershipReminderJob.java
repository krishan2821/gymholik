package com.gymapp.module.notification.job;

import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.notification.entity.ReminderLog;
import com.gymapp.module.notification.repository.ReminderLogRepository;
import com.gymapp.module.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class MembershipReminderJob {

    private final MongoTemplate mongoTemplate;
    private final MemberRepository memberRepository;
    private final ReminderLogRepository reminderLogRepository;
    private final NotificationService notificationService;

    // Runs every day at 9:00 AM
    @Scheduled(cron = "0 0 9 * * ?")
    public void processReminders() {
        log.info("Starting daily membership reminder job...");
        LocalDate today = LocalDate.now();

        processForDays(today.plusDays(3), "EXPIRING_IN_3_DAYS", "Your gym membership expires in 3 days.");
        processForDays(today.plusDays(1), "EXPIRING_IN_1_DAY", "Your gym membership expires tomorrow!");
        processForDays(today, "EXPIRED_TODAY", "Your gym membership expires today. Please renew to continue.");

        log.info("Finished daily membership reminder job.");
    }

    private void processForDays(LocalDate targetDate, String reminderType, String messagePrefix) {
        Query query = new Query(Criteria.where("expiryDate").is(targetDate).and("status").is("ACTIVE"));
        List<Membership> memberships = mongoTemplate.find(query, Membership.class);

        for (Membership membership : memberships) {
            boolean alreadyNotified = reminderLogRepository.existsByGymIdAndMemberIdAndType(
                    membership.getGymId(), membership.getMemberId(), reminderType);

            if (!alreadyNotified) {
                Optional<Member> memberOpt = memberRepository.findByIdAndGymId(membership.getMemberId(), membership.getGymId());
                if (memberOpt.isPresent()) {
                    Member member = memberOpt.get();
                    if ("ACTIVE".equals(member.getStatus()) && member.getPhone() != null) {
                        String message = String.format("Hi %s, %s", member.getName(), messagePrefix);
                        try {
                            notificationService.sendReminder(member.getPhone(), message);
                            
                            ReminderLog logEntry = ReminderLog.builder()
                                    .gymId(membership.getGymId())
                                    .memberId(member.getId())
                                    .membershipId(membership.getId())
                                    .type(reminderType)
                                    .build();
                            reminderLogRepository.save(logEntry);
                        } catch (Exception e) {
                            log.error("Failed to send reminder for member {}", member.getId(), e);
                        }
                    }
                }
            }
        }
    }
}
