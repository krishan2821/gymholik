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

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class MoneyRepairMigrationService {

    private final MembershipRepository membershipRepository;
    private final MemberRepository memberRepository;
    private final PaymentRepository paymentRepository;
    private final MembershipLedgerService membershipLedgerService;

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
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberMismatch {
        private String id;
        private String gymId;
        private String memberCode;
        private String name;
        private long storedDuePaise;
        private long expectedDuePaise;
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
        private int fixedMembershipsCount;
        private int fixedMembersCount;
    }

    public MoneyRepairReport runRepair(boolean dryRun) {
        log.info("Starting Money Repair Migration (dryRun={})", dryRun);

        List<Membership> allMemberships = membershipRepository.findAll();
        List<MembershipMismatch> memMismatches = new ArrayList<>();
        Set<String> affectedGyms = new HashSet<>();

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
            long expectedDuePaise = Math.max(0L, m.getTotalPaise() - m.getDiscountPaise() - netPaidPaise);

            if (m.getPaidPaise() != netPaidPaise || m.getDuePaise() != expectedDuePaise) {
                memMismatches.add(MembershipMismatch.builder()
                        .id(m.getId())
                        .gymId(gymId)
                        .memberId(m.getMemberId())
                        .storedPaidPaise(m.getPaidPaise())
                        .expectedPaidPaise(netPaidPaise)
                        .storedDuePaise(m.getDuePaise())
                        .expectedDuePaise(expectedDuePaise)
                        .build());
                affectedGyms.add(gymId);

                if (!dryRun) {
                    m.setPaidPaise(netPaidPaise);
                    m.setDuePaise(expectedDuePaise);
                    membershipRepository.save(m);
                }
            }
        }

        List<Member> allMembers = memberRepository.findAll();
        List<MemberMismatch> memberMismatches = new ArrayList<>();

        for (Member member : allMembers) {
            String gymId = member.getGymId();
            List<Membership> mems = membershipRepository.findByGymIdAndMemberId(gymId, member.getId());
            long expectedDue = Math.max(0L, mems.stream().mapToLong(Membership::getDuePaise).sum());

            if (member.getCurrentDuePaise() != expectedDue) {
                memberMismatches.add(MemberMismatch.builder()
                        .id(member.getId())
                        .gymId(gymId)
                        .memberCode(member.getMemberCode())
                        .name(member.getName())
                        .storedDuePaise(member.getCurrentDuePaise())
                        .expectedDuePaise(expectedDue)
                        .build());
                affectedGyms.add(gymId);

                if (!dryRun) {
                    member.setCurrentDuePaise(expectedDue);
                    memberRepository.save(member);
                }
            }
        }

        if (!dryRun) {
            for (String gymId : affectedGyms) {
                membershipLedgerService.evictCaches(gymId);
            }
        }

        MoneyRepairReport report = MoneyRepairReport.builder()
                .dryRun(dryRun)
                .totalMembershipsExamined(allMemberships.size())
                .totalMembersExamined(allMembers.size())
                .membershipMismatches(memMismatches)
                .memberMismatches(memberMismatches)
                .fixedMembershipsCount(dryRun ? 0 : memMismatches.size())
                .fixedMembersCount(dryRun ? 0 : memberMismatches.size())
                .build();

        log.info("Money Repair Migration finished: examined {} memberships (mismatches: {}), {} members (mismatches: {})",
                allMemberships.size(), memMismatches.size(), allMembers.size(), memberMismatches.size());

        return report;
    }
}
