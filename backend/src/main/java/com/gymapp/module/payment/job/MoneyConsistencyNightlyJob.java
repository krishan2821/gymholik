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

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class MoneyConsistencyNightlyJob {

    private final MembershipRepository membershipRepository;
    private final MemberRepository memberRepository;
    private final PaymentRepository paymentRepository;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InvariantViolation {
        private String entityType; // MEMBERSHIP or MEMBER
        private String entityId;
        private String gymId;
        private String description;
        private long storedValue;
        private long expectedValue;
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

    @Scheduled(cron = "${app.jobs.nightly-invariant-check:0 0 2 * * ?}")
    public InvariantReport runNightlyCheck() {
        log.info("Running nightly money consistency invariant check...");
        InvariantReport report = checkInvariants();
        if (report.hasViolations()) {
            log.warn("Nightly money consistency check completed with {} VIOLATIONS!", report.getViolations().size());
            for (InvariantViolation v : report.getViolations()) {
                log.warn("Invariant violation [{} id={} gymId={}]: {} (stored={}, expected={})",
                        v.getEntityType(), v.getEntityId(), v.getGymId(), v.getDescription(), v.getStoredValue(), v.getExpectedValue());
            }
        } else {
            log.info("Nightly money consistency check completed successfully. 0 violations across {} memberships and {} members.",
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
                        .storedValue(m.getPaidPaise())
                        .expectedValue(netPaidPaise)
                        .build());
            }

            long expectedDuePaise = Math.max(0L, m.getTotalPaise() - m.getDiscountPaise() - netPaidPaise);
            if (m.getDuePaise() != expectedDuePaise) {
                violations.add(InvariantViolation.builder()
                        .entityType("MEMBERSHIP")
                        .entityId(m.getId())
                        .gymId(gymId)
                        .description("Membership duePaise != totalPaise - discountPaise - paidPaise")
                        .storedValue(m.getDuePaise())
                        .expectedValue(expectedDuePaise)
                        .build());
            }

            if (m.getDuePaise() < 0) {
                violations.add(InvariantViolation.builder()
                        .entityType("MEMBERSHIP")
                        .entityId(m.getId())
                        .gymId(gymId)
                        .description("Membership duePaise cannot be negative")
                        .storedValue(m.getDuePaise())
                        .expectedValue(0L)
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
                        .storedValue(member.getCurrentDuePaise())
                        .expectedValue(expectedDue)
                        .build());
            }

            if (member.getCurrentDuePaise() < 0) {
                violations.add(InvariantViolation.builder()
                        .entityType("MEMBER")
                        .entityId(member.getId())
                        .gymId(gymId)
                        .description("Member currentDuePaise cannot be negative")
                        .storedValue(member.getCurrentDuePaise())
                        .expectedValue(0L)
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
