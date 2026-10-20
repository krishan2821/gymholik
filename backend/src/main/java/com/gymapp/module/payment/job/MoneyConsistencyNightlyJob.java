package com.gymapp.module.payment.job;

import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
import com.gymapp.module.payment.entity.Payment;
import com.gymapp.module.payment.repository.PaymentRepository;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class MoneyConsistencyNightlyJob {

    private final MembershipRepository membershipRepository;
    private final MemberRepository memberRepository;
    private final PaymentRepository paymentRepository;
    private final Clock clock;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InvariantViolation {
        private String entityType; // MEMBERSHIP or MEMBER
        private String entityId;
        private String gymId;
        private String description;
        private String storedValue;
        private String expectedValue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InvariantReport {
        private int totalMembershipsChecked;
        private int totalMembersChecked;
        private List<InvariantViolation> violations;

        public boolean hasViolations() {
            return violations != null && !violations.isEmpty();
        }
    }

    @Scheduled(cron = "${app.jobs.nightly-invariant-check:0 0 2 * * ?}", zone = "Asia/Kolkata")
    public InvariantReport runNightlyCheck() {
        log.info("Running nightly money and status consistency invariant check...");
        InvariantReport report = checkInvariants();
        if (report.hasViolations()) {
            log.warn("Nightly invariant check completed with {} VIOLATIONS!", report.getViolations().size());
            for (InvariantViolation v : report.getViolations()) {
                log.warn("Invariant violation [{} id={} gymId={}]: {} (stored={}, expected={})",
                        v.getEntityType(), v.getEntityId(), v.getGymId(), v.getDescription(), v.getStoredValue(), v.getExpectedValue());
            }
        } else {
            log.info("Nightly invariant check completed successfully. 0 violations across {} memberships and {} members.",
                    report.getTotalMembershipsChecked(), report.getTotalMembersChecked());
        }
        return report;
    }

    public InvariantReport checkInvariants() {
        List<Membership> memberships = membershipRepository.findAll();
        List<Member> members = memberRepository.findAll();
        return evaluateInvariants(memberships, members);
    }

    public InvariantReport checkInvariantsForGym(String gymId) {
        List<Membership> memberships = membershipRepository.findByGymId(gymId);
        List<Member> members = memberRepository.findByGymId(gymId);
        return evaluateInvariants(memberships, members);
    }

    private InvariantReport evaluateInvariants(List<Membership> memberships, List<Member> members) {
        List<InvariantViolation> violations = new ArrayList<>();
        LocalDate today = LocalDate.now(clock);

        for (Membership m : memberships) {
            String gymId = m.getGymId();
            List<Payment> payments = paymentRepository.findByGymIdAndMembershipId(gymId, m.getId());

            long netPaidPaise = 0L;
            for (Payment p : payments) {
                if ("REVERSAL".equalsIgnoreCase(p.getType()) || p.getReversalOfId() != null) {
                    netPaidPaise -= p.getAmountPaise();
                } else {
                    netPaidPaise += p.getAmountPaise();
                }
            }
            netPaidPaise = Math.max(0L, netPaidPaise);

            if (m.getPaidPaise() != netPaidPaise) {
                violations.add(InvariantViolation.builder()
                        .entityType("MEMBERSHIP")
                        .entityId(m.getId())
                        .gymId(gymId)
                        .description("Membership paidPaise does not match sum of payments")
                        .storedValue(String.valueOf(m.getPaidPaise()))
                        .expectedValue(String.valueOf(netPaidPaise))
                        .build());
            }

            long expectedDuePaise = Math.max(0L, m.getTotalPaise() - m.getDiscountPaise() - netPaidPaise);
            if (m.getDuePaise() != expectedDuePaise) {
                violations.add(InvariantViolation.builder()
                        .entityType("MEMBERSHIP")
                        .entityId(m.getId())
                        .gymId(gymId)
                        .description("Membership duePaise != totalPaise - discountPaise - paidPaise")
                        .storedValue(String.valueOf(m.getDuePaise()))
                        .expectedValue(String.valueOf(expectedDuePaise))
                        .build());
            }

            if (m.getDuePaise() < 0) {
                violations.add(InvariantViolation.builder()
                        .entityType("MEMBERSHIP")
                        .entityId(m.getId())
                        .gymId(gymId)
                        .description("Membership duePaise cannot be negative")
                        .storedValue(String.valueOf(m.getDuePaise()))
                        .expectedValue("0")
                        .build());
            }

            Membership.MembershipStatus expectedStatus;
            if (m.getStartDate() != null && m.getStartDate().isAfter(today)) {
                expectedStatus = Membership.MembershipStatus.UPCOMING;
            } else if (m.getExpiryDate() != null && m.getExpiryDate().isBefore(today)) {
                expectedStatus = Membership.MembershipStatus.EXPIRED;
            } else {
                expectedStatus = Membership.MembershipStatus.ACTIVE;
            }

            if (m.getStatus() != expectedStatus) {
                violations.add(InvariantViolation.builder()
                        .entityType("MEMBERSHIP")
                        .entityId(m.getId())
                        .gymId(gymId)
                        .description("Membership status does not match calendar dates")
                        .storedValue(String.valueOf(m.getStatus()))
                        .expectedValue(String.valueOf(expectedStatus))
                        .build());
            }
        }

        for (Member member : members) {
            String gymId = member.getGymId();
            List<Membership> memberMems = membershipRepository.findByGymIdAndMemberId(gymId, member.getId());
            long expectedDue = Math.max(0L, memberMems.stream().mapToLong(Membership::getDuePaise).sum());

            if (member.getCurrentDuePaise() != expectedDue) {
                violations.add(InvariantViolation.builder()
                        .entityType("MEMBER")
                        .entityId(member.getId())
                        .gymId(gymId)
                        .description("Member currentDuePaise != sum of memberships duePaise")
                        .storedValue(String.valueOf(member.getCurrentDuePaise()))
                        .expectedValue(String.valueOf(expectedDue))
                        .build());
            }

            if (member.getCurrentDuePaise() < 0) {
                violations.add(InvariantViolation.builder()
                        .entityType("MEMBER")
                        .entityId(member.getId())
                        .gymId(gymId)
                        .description("Member currentDuePaise cannot be negative")
                        .storedValue(String.valueOf(member.getCurrentDuePaise()))
                        .expectedValue("0")
                        .build());
            }

            LocalDate expectedExpiry = memberMems.stream()
                    .map(Membership::getExpiryDate)
                    .filter(Objects::nonNull)
                    .max(LocalDate::compareTo)
                    .orElse(null);

            if (!Objects.equals(member.getCurrentExpiry(), expectedExpiry)) {
                violations.add(InvariantViolation.builder()
                        .entityType("MEMBER")
                        .entityId(member.getId())
                        .gymId(gymId)
                        .description("Member currentExpiry does not match max membership expiry")
                        .storedValue(String.valueOf(member.getCurrentExpiry()))
                        .expectedValue(String.valueOf(expectedExpiry))
                        .build());
            }

            Membership current = memberMems.stream()
                    .filter(m -> m.getStartDate() != null && m.getExpiryDate() != null
                            && !m.getStartDate().isAfter(today) && !m.getExpiryDate().isBefore(today))
                    .max(Comparator.comparing(Membership::getExpiryDate, Comparator.nullsLast(Comparator.naturalOrder())))
                    .orElse(null);

            if (current == null) {
                current = memberMems.stream()
                        .filter(m -> m.getStartDate() != null && m.getStartDate().isAfter(today))
                        .min(Comparator.comparing(Membership::getStartDate, Comparator.nullsLast(Comparator.naturalOrder())))
                        .orElse(null);
            }

            if (current == null) {
                current = memberMems.stream()
                        .filter(m -> m.getExpiryDate() != null && m.getExpiryDate().isBefore(today))
                        .max(Comparator.comparing(Membership::getExpiryDate, Comparator.nullsLast(Comparator.naturalOrder())))
                        .orElse(null);
            }

            String expectedMembershipId = current != null ? current.getId() : null;
            if (!Objects.equals(member.getCurrentMembershipId(), expectedMembershipId)) {
                violations.add(InvariantViolation.builder()
                        .entityType("MEMBER")
                        .entityId(member.getId())
                        .gymId(gymId)
                        .description("Member currentMembershipId does not match covering/upcoming/expired priority")
                        .storedValue(String.valueOf(member.getCurrentMembershipId()))
                        .expectedValue(String.valueOf(expectedMembershipId))
                        .build());
            }
        }

        return InvariantReport.builder()
                .totalMembershipsChecked(memberships.size())
                .totalMembersChecked(members.size())
                .violations(violations)
                .build();
    }
}
