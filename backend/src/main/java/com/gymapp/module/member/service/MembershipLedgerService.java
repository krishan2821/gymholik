package com.gymapp.module.member.service;

import com.gymapp.module.dashboard.service.DashboardService;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
import com.gymapp.module.payment.entity.Payment;
import com.gymapp.module.payment.repository.PaymentRepository;
import com.gymapp.module.payment.service.PaymentService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Slf4j
@Service
public class MembershipLedgerService {

    private final PaymentRepository paymentRepository;
    private final MembershipRepository membershipRepository;
    private final MemberRepository memberRepository;
    private final DashboardService dashboardService;
    private final PaymentService paymentService;
    private final Clock clock;

    public MembershipLedgerService(
            PaymentRepository paymentRepository,
            MembershipRepository membershipRepository,
            MemberRepository memberRepository,
            DashboardService dashboardService,
            @Lazy PaymentService paymentService,
            Clock clock) {
        this.paymentRepository = paymentRepository;
        this.membershipRepository = membershipRepository;
        this.memberRepository = memberRepository;
        this.dashboardService = dashboardService;
        this.paymentService = paymentService;
        this.clock = clock;
    }

    /**
     * Recalculates all memberships and member-level aggregates for a member in a gym.
     * Payments are the single source of truth.
     *
     * @param gymId tenant gym ID
     * @param memberId member ID (or membership ID fallback)
     */
    @Transactional
    public void recalculate(String gymId, String memberId) {
        if (gymId == null || memberId == null) {
            return;
        }

        String resolvedMemberId = memberId;
        Optional<Member> memberOpt = memberRepository.findByIdAndGymId(resolvedMemberId, gymId);
        if (memberOpt.isEmpty()) {
            // Check if memberId was actually a membershipId
            Optional<Membership> memOpt = membershipRepository.findByIdAndGymId(memberId, gymId);
            if (memOpt.isPresent()) {
                resolvedMemberId = memOpt.get().getMemberId();
                memberOpt = memberRepository.findByIdAndGymId(resolvedMemberId, gymId);
            }
        }

        if (memberOpt.isEmpty()) {
            return;
        }

        Member member = memberOpt.get();
        LocalDate today = LocalDate.now(clock);

        List<Membership> memberships = membershipRepository.findByGymIdAndMemberId(gymId, resolvedMemberId);
        for (Membership m : memberships) {
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
            long duePaise = rawDue;
            if (rawDue < 0) {
                log.warn("Computed negative due for membership {} in gym {}: total={}, discount={}, paid={}. Clamping to 0.",
                        m.getId(), gymId, m.getTotalPaise(), m.getDiscountPaise(), netPaidPaise);
                duePaise = 0L;
            }

            Membership.MembershipStatus status;
            if (m.getStartDate() != null && m.getStartDate().isAfter(today)) {
                status = Membership.MembershipStatus.UPCOMING;
            } else if (m.getExpiryDate() != null && m.getExpiryDate().isBefore(today)) {
                status = Membership.MembershipStatus.EXPIRED;
            } else {
                status = Membership.MembershipStatus.ACTIVE;
            }

            m.setPaidPaise(netPaidPaise);
            m.setDuePaise(duePaise);
            m.setStatus(status);
            membershipRepository.save(m);
        }

        long totalDue = Math.max(0L, memberships.stream().mapToLong(Membership::getDuePaise).sum());
        member.setCurrentDuePaise(totalDue);

        LocalDate maxExpiry = memberships.stream()
                .map(Membership::getExpiryDate)
                .filter(Objects::nonNull)
                .max(LocalDate::compareTo)
                .orElse(null);
        member.setCurrentExpiry(maxExpiry);

        // Current membership determination:
        // 1. Covering today (startDate <= today <= expiryDate)
        Membership current = memberships.stream()
                .filter(m -> m.getStartDate() != null && m.getExpiryDate() != null
                        && !m.getStartDate().isAfter(today) && !m.getExpiryDate().isBefore(today))
                .max(Comparator.comparing(Membership::getExpiryDate, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);

        // 2. Next UPCOMING (earliest startDate after today)
        if (current == null) {
            current = memberships.stream()
                    .filter(m -> m.getStartDate() != null && m.getStartDate().isAfter(today))
                    .min(Comparator.comparing(Membership::getStartDate, Comparator.nullsLast(Comparator.naturalOrder())))
                    .orElse(null);
        }

        // 3. Latest EXPIRED (latest expiryDate before today)
        if (current == null) {
            current = memberships.stream()
                    .filter(m -> m.getExpiryDate() != null && m.getExpiryDate().isBefore(today))
                    .max(Comparator.comparing(Membership::getExpiryDate, Comparator.nullsLast(Comparator.naturalOrder())))
                    .orElse(null);
        }

        member.setCurrentMembershipId(current != null ? current.getId() : null);
        memberRepository.save(member);

        evictCaches(gymId);
    }

    @Transactional
    public void recalculateMember(String gymId, String memberId) {
        recalculate(gymId, memberId);
    }

    public void evictCaches(String gymId) {
        if (dashboardService != null) {
            try {
                dashboardService.evictCache(gymId);
            } catch (Exception e) {
                log.warn("Failed to evict dashboard cache for gymId: {}", gymId, e);
            }
        }
        if (paymentService != null) {
            try {
                paymentService.evictSummaryCache(gymId);
            } catch (Exception e) {
                log.warn("Failed to evict payment summary cache for gymId: {}", gymId, e);
            }
        }
    }
}
