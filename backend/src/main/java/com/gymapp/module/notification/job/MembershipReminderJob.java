package com.gymapp.module.notification.job;

import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
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

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class MembershipReminderJob {

    private final MongoTemplate mongoTemplate;
    private final MemberRepository memberRepository;
    private final MembershipRepository membershipRepository;
    private final ReminderLogRepository reminderLogRepository;
    private final NotificationService notificationService;
    private final Clock clock;

    // Runs every day at 9:00 AM IST
    @Scheduled(cron = "0 0 9 * * ?", zone = "Asia/Kolkata")
    public void processReminders() {
        log.info("Starting daily membership reminder job...");
        LocalDate today = LocalDate.now(clock);

        processForDays(today.plusDays(3), "EXPIRING_IN_3_DAYS", "Your gym membership expires in 3 days.");
        processForDays(today.plusDays(1), "EXPIRING_IN_1_DAY", "Your gym membership expires tomorrow!");
        processForDays(today, "EXPIRED_TODAY", "Your gym membership expires today. Please renew to continue.");

        log.info("Finished daily membership reminder job.");
    }

    private void processForDays(LocalDate targetDate, String reminderType, String messagePrefix) {
        // Query members whose currentExpiry (end of coverage) equals targetDate
        Query query = new Query(Criteria.where("currentExpiry").is(targetDate).and("status").is("ACTIVE"));
        List<Member> members = mongoTemplate.find(query, Member.class);

        for (Member member : members) {
            if (member.getPhone() == null || member.getPhone().isBlank()) {
                continue;
            }

            // Find last membership of the member as the reminder key
            Membership lastMembership = membershipRepository.findTopByMemberIdAndGymIdOrderByExpiryDateDesc(
                    member.getId(), member.getGymId()).orElse(null);

            if (lastMembership == null) {
                continue;
            }

            // Reminder logs stay unique per (gymId, membershipId, type)
            boolean alreadyNotified = reminderLogRepository.existsByGymIdAndMembershipIdAndType(
                    member.getGymId(), lastMembership.getId(), reminderType);

            if (!alreadyNotified) {
                String message = String.format("Hi %s, %s", member.getName(), messagePrefix);
                try {
                    notificationService.sendReminder(member.getPhone(), message);

                    ReminderLog logEntry = ReminderLog.builder()
                            .gymId(member.getGymId())
                            .memberId(member.getId())
                            .membershipId(lastMembership.getId())
                            .type(reminderType)
                            .channel("SMS")
                            .sentAt(LocalDateTime.now(clock))
                            .status("SENT")
                            .build();
                    reminderLogRepository.save(logEntry);
                } catch (Exception e) {
                    log.error("Failed to send reminder for member {}", member.getId(), e);
                }
            }
        }
    }
}
