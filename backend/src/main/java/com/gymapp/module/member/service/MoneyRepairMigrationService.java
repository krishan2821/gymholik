package com.gymapp.module.member.service;

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
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class MoneyRepairMigrationService {

    private final MembershipRepository membershipRepository;
    private final MemberRepository memberRepository;
    private final PaymentRepository paymentRepository;
    private final MembershipLedgerService membershipLedgerService;
    private final Clock clock;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MembershipMismatch {
        private String id;
        private String gymId;
        private String memberId;
        private long storedPaidPaise;
        private long expectedPaidPaise;
        private long storedDuePaise;
        private long expectedDuePaise;
        private String storedStatus;
        private String expectedStatus;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberMismatch {
        private String id;
        private String gymId;
        private long storedDuePaise;
        private long expectedDuePaise;
        private String storedMembershipId;
        private String expectedMembershipId;
        private LocalDate storedExpiry;
        private LocalDate expectedExpiry;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DocumentMismatch {
        private String collection;
        private String documentId;
        private String field;
        private Object storedValue;
        private Object recomputedValue;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MismatchCounts {
        private int negativeDue;
        private int dueDiffers;
        private int missingCurrentMembershipId;
        private int wrongCurrentExpiry;
        private int wrongMembershipStatus;
        private int paidDiffersFromSumOfPayments;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MoneyRepairReport {
        private boolean dryRun;
        private int totalMembershipsExamined;
        private int totalMembersExamined;
        private List<MembershipMismatch> membershipMismatches;
        private List<MemberMismatch> memberMismatches;
        private List<DocumentMismatch> documentMismatches;
        private MismatchCounts mismatchCounts;
        private int fixedMembershipsCount;
        private int fixedMembersCount;
    }

    public MoneyRepairReport runRepair(boolean dryRun) {
        return runRepair(null, dryRun);
    }

    public MoneyRepairReport runRepair(String targetGymId, boolean dryRun) {
        log.info("Starting Money and Status Repair Migration (targetGymId={}, dryRun={})", targetGymId, dryRun);
        LocalDate today = LocalDate.now(clock);

        List<Membership> allMemberships = (targetGymId != null)
                ? membershipRepository.findByGymId(targetGymId)
                : membershipRepository.findAll();
        List<MembershipMismatch> memMismatches = new ArrayList<>();
        List<DocumentMismatch> docMismatches = new ArrayList<>();
        Set<String> affectedGyms = new HashSet<>();

        int negativeDueCount = 0;
        int dueDiffersCount = 0;
        int missingCurrentMembershipIdCount = 0;
        int wrongCurrentExpiryCount = 0;
        int wrongMembershipStatusCount = 0;
        int paidDiffersFromSumOfPaymentsCount = 0;

        for (Membership m : allMemberships) {
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
            long rawDue = m.getTotalPaise() - m.getDiscountPaise() - netPaidPaise;
            long expectedDuePaise = Math.max(0L, rawDue);

            Membership.MembershipStatus expectedStatus;
            if (m.getStartDate() != null && m.getStartDate().isAfter(today)) {
                expectedStatus = Membership.MembershipStatus.UPCOMING;
            } else if (m.getExpiryDate() != null && m.getExpiryDate().isBefore(today)) {
                expectedStatus = Membership.MembershipStatus.EXPIRED;
            } else {
                expectedStatus = Membership.MembershipStatus.ACTIVE;
            }

            boolean paidMismatch = (m.getPaidPaise() != netPaidPaise);
            boolean dueMismatch = (m.getDuePaise() != expectedDuePaise);
            boolean statusMismatch = (m.getStatus() != expectedStatus);
            boolean negativeDue = (m.getDuePaise() < 0 || m.getPaidPaise() < 0);

            if (negativeDue) {
                negativeDueCount++;
                docMismatches.add(DocumentMismatch.builder()
                        .collection("memberships")
                        .documentId(m.getId())
                        .field("duePaise (negative)")
                        .storedValue(m.getDuePaise())
                        .recomputedValue(expectedDuePaise)
                        .build());
            }

            if (paidMismatch) {
                paidDiffersFromSumOfPaymentsCount++;
                docMismatches.add(DocumentMismatch.builder()
                        .collection("memberships")
                        .documentId(m.getId())
                        .field("paidPaise")
                        .storedValue(m.getPaidPaise())
                        .recomputedValue(netPaidPaise)
                        .build());
            }

            if (dueMismatch) {
                dueDiffersCount++;
                docMismatches.add(DocumentMismatch.builder()
                        .collection("memberships")
                        .documentId(m.getId())
                        .field("duePaise")
                        .storedValue(m.getDuePaise())
                        .recomputedValue(expectedDuePaise)
                        .build());
            }

            if (statusMismatch) {
                wrongMembershipStatusCount++;
                docMismatches.add(DocumentMismatch.builder()
                        .collection("memberships")
                        .documentId(m.getId())
                        .field("status")
                        .storedValue(m.getStatus() != null ? m.getStatus().name() : null)
                        .recomputedValue(expectedStatus.name())
                        .build());
            }

            if (paidMismatch || dueMismatch || statusMismatch || negativeDue) {
                memMismatches.add(MembershipMismatch.builder()
                        .id(m.getId())
                        .gymId(gymId)
                        .memberId(m.getMemberId())
                        .storedPaidPaise(m.getPaidPaise())
                        .expectedPaidPaise(netPaidPaise)
                        .storedDuePaise(m.getDuePaise())
                        .expectedDuePaise(expectedDuePaise)
                        .storedStatus(m.getStatus() != null ? m.getStatus().name() : null)
                        .expectedStatus(expectedStatus.name())
                        .build());
                affectedGyms.add(gymId);

                if (!dryRun) {
                    m.setPaidPaise(netPaidPaise);
                    m.setDuePaise(expectedDuePaise);
                    m.setStatus(expectedStatus);
                    membershipRepository.save(m);
                }
            }
        }

        List<Member> allMembers = (targetGymId != null)
                ? memberRepository.findByGymId(targetGymId)
                : memberRepository.findAll();
        List<MemberMismatch> memberMismatches = new ArrayList<>();

        for (Member member : allMembers) {
            String gymId = member.getGymId();
            List<Membership> mems = membershipRepository.findByGymIdAndMemberId(gymId, member.getId());

            long sumStoredMemDue = mems.stream().mapToLong(Membership::getDuePaise).sum();
            long sumRecomputedDue = 0L;
            for (Membership mem : mems) {
                List<Payment> memPayments = paymentRepository.findByGymIdAndMembershipId(gymId, mem.getId());
                long np = 0L;
                for (Payment p : memPayments) {
                    if ("REVERSAL".equalsIgnoreCase(p.getType()) || p.getReversalOfId() != null) {
                        np -= p.getAmountPaise();
                    } else {
                        np += p.getAmountPaise();
                    }
                }
                np = Math.max(0L, np);
                long rawDue = mem.getTotalPaise() - mem.getDiscountPaise() - np;
                sumRecomputedDue += Math.max(0L, rawDue);
            }

            LocalDate expectedExpiry = mems.stream()
                    .map(Membership::getExpiryDate)
                    .filter(Objects::nonNull)
                    .max(LocalDate::compareTo)
                    .orElse(null);

            // 1. Covering today
            Membership current = mems.stream()
                    .filter(m -> m.getStartDate() != null && m.getExpiryDate() != null
                            && !m.getStartDate().isAfter(today) && !m.getExpiryDate().isBefore(today))
                    .max(Comparator.comparing(Membership::getExpiryDate, Comparator.nullsLast(Comparator.naturalOrder())))
                    .orElse(null);

            // 2. Next UPCOMING
            if (current == null) {
                current = mems.stream()
                        .filter(m -> m.getStartDate() != null && m.getStartDate().isAfter(today))
                        .min(Comparator.comparing(Membership::getStartDate, Comparator.nullsLast(Comparator.naturalOrder())))
                        .orElse(null);
            }

            // 3. Latest EXPIRED
            if (current == null) {
                current = mems.stream()
                        .filter(m -> m.getExpiryDate() != null && m.getExpiryDate().isBefore(today))
                        .max(Comparator.comparing(Membership::getExpiryDate, Comparator.nullsLast(Comparator.naturalOrder())))
                        .orElse(null);
            }

            String expectedMembershipId = current != null ? current.getId() : null;

            long storedMemberDue = member.getCurrentDuePaise(); // raw value, negatives included
            boolean negativeMemberDue = (storedMemberDue < 0);
            boolean dueMismatch = (storedMemberDue != sumStoredMemDue || storedMemberDue != sumRecomputedDue);
            boolean memIdMismatch = !Objects.equals(member.getCurrentMembershipId(), expectedMembershipId);
            boolean expiryMismatch = !Objects.equals(member.getCurrentExpiry(), expectedExpiry);

            if (negativeMemberDue) {
                negativeDueCount++;
                docMismatches.add(DocumentMismatch.builder()
                        .collection("members")
                        .documentId(member.getId())
                        .field("currentDuePaise (negative)")
                        .storedValue(storedMemberDue)
                        .recomputedValue(sumRecomputedDue)
                        .build());
            }

            if (dueMismatch) {
                dueDiffersCount++;
                docMismatches.add(DocumentMismatch.builder()
                        .collection("members")
                        .documentId(member.getId())
                        .field("currentDuePaise")
                        .storedValue(storedMemberDue)
                        .recomputedValue(sumRecomputedDue)
                        .build());
            }

            if (!mems.isEmpty() && member.getCurrentMembershipId() == null) {
                missingCurrentMembershipIdCount++;
                docMismatches.add(DocumentMismatch.builder()
                        .collection("members")
                        .documentId(member.getId())
                        .field("currentMembershipId")
                        .storedValue(null)
                        .recomputedValue(expectedMembershipId)
                        .build());
            } else if (memIdMismatch) {
                docMismatches.add(DocumentMismatch.builder()
                        .collection("members")
                        .documentId(member.getId())
                        .field("currentMembershipId")
                        .storedValue(member.getCurrentMembershipId())
                        .recomputedValue(expectedMembershipId)
                        .build());
            }

            if (expiryMismatch) {
                wrongCurrentExpiryCount++;
                docMismatches.add(DocumentMismatch.builder()
                        .collection("members")
                        .documentId(member.getId())
                        .field("currentExpiry")
                        .storedValue(member.getCurrentExpiry())
                        .recomputedValue(expectedExpiry)
                        .build());
            }

            if (dueMismatch || memIdMismatch || expiryMismatch || negativeMemberDue) {
                memberMismatches.add(MemberMismatch.builder()
                        .id(member.getId())
                        .gymId(gymId)
                        .storedDuePaise(storedMemberDue)
                        .expectedDuePaise(sumRecomputedDue)
                        .storedMembershipId(member.getCurrentMembershipId())
                        .expectedMembershipId(expectedMembershipId)
                        .storedExpiry(member.getCurrentExpiry())
                        .expectedExpiry(expectedExpiry)
                        .build());
                affectedGyms.add(gymId);

                if (!dryRun) {
                    member.setCurrentDuePaise(sumRecomputedDue);
                    member.setCurrentMembershipId(expectedMembershipId);
                    member.setCurrentExpiry(expectedExpiry);
                    memberRepository.save(member);
                }
            }
        }

        if (!dryRun) {
            for (String gymId : affectedGyms) {
                membershipLedgerService.evictCaches(gymId);
            }
        }

        MismatchCounts counts = MismatchCounts.builder()
                .negativeDue(negativeDueCount)
                .dueDiffers(dueDiffersCount)
                .missingCurrentMembershipId(missingCurrentMembershipIdCount)
                .wrongCurrentExpiry(wrongCurrentExpiryCount)
                .wrongMembershipStatus(wrongMembershipStatusCount)
                .paidDiffersFromSumOfPayments(paidDiffersFromSumOfPaymentsCount)
                .build();

        MoneyRepairReport report = MoneyRepairReport.builder()
                .dryRun(dryRun)
                .totalMembershipsExamined(allMemberships.size())
                .totalMembersExamined(allMembers.size())
                .membershipMismatches(memMismatches)
                .memberMismatches(memberMismatches)
                .documentMismatches(docMismatches)
                .mismatchCounts(counts)
                .fixedMembershipsCount(dryRun ? 0 : memMismatches.size())
                .fixedMembersCount(dryRun ? 0 : memberMismatches.size())
                .build();

        log.info("Money Repair Migration finished: examined {} memberships (mismatches: {}), {} members (mismatches: {}). Counts: {}",
                allMemberships.size(), memMismatches.size(), allMembers.size(), memberMismatches.size(), counts);

        return report;
    }
}
