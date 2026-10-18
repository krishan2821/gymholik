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

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
public class MembershipLedgerService {

    private final PaymentRepository paymentRepository;
    private final MembershipRepository membershipRepository;
    private final MemberRepository memberRepository;
    private final DashboardService dashboardService;
    private final PaymentService paymentService;

    public MembershipLedgerService(
            PaymentRepository paymentRepository,
            MembershipRepository membershipRepository,
            MemberRepository memberRepository,
            DashboardService dashboardService,
            @Lazy PaymentService paymentService) {
        this.paymentRepository = paymentRepository;
        this.membershipRepository = membershipRepository;
        this.memberRepository = memberRepository;
        this.dashboardService = dashboardService;
        this.paymentService = paymentService;
    }

    /**
     * Recalculates membership paidPaise and duePaise from the append-only Payment ledger,
     * then cascades the recalculation to the member's currentDuePaise and latest expiry.
     */
    @Transactional
    public void recalculate(String gymId, String membershipId) {
        if (gymId == null || membershipId == null) {
            return;
        }

        Membership membership = membershipRepository.findByIdAndGymId(membershipId, gymId).orElse(null);
        if (membership == null) {
            return;
        }

        List<Payment> payments = paymentRepository.findByGymIdAndMembershipId(gymId, membershipId);
        long netPaidPaise = 0L;
        for (Payment p : payments) {
            if ("REVERSAL".equalsIgnoreCase(p.getType()) || p.getReversalOfId() != null) {
                netPaidPaise -= p.getAmountPaise();
            } else {
                netPaidPaise += p.getAmountPaise();
            }
        }
        netPaidPaise = Math.max(0L, netPaidPaise);

        membership.setPaidPaise(netPaidPaise);
        long expectedDue = Math.max(0L, membership.getTotalPaise() - membership.getDiscountPaise() - netPaidPaise);
        membership.setDuePaise(expectedDue);
        membershipRepository.save(membership);

        recalculateMember(gymId, membership.getMemberId());
    }

    /**
     * Recalculates member currentDuePaise as the sum of all their memberships' duePaise,
     * and refreshes currentExpiry to the latest active/non-deleted membership expiry date.
     */
    @Transactional
    public void recalculateMember(String gymId, String memberId) {
        if (gymId == null || memberId == null) {
            return;
        }

        Member member = memberRepository.findByIdAndGymId(memberId, gymId).orElse(null);
        if (member == null) {
            return;
        }

        List<Membership> memberships = membershipRepository.findByGymIdAndMemberId(gymId, memberId);
        long totalDue = 0L;
        LocalDate latestExpiry = null;
        for (Membership m : memberships) {
            totalDue += m.getDuePaise();
            if (m.getExpiryDate() != null) {
                if (latestExpiry == null || m.getExpiryDate().isAfter(latestExpiry)) {
                    latestExpiry = m.getExpiryDate();
                }
            }
        }

        member.setCurrentDuePaise(Math.max(0L, totalDue));
        if (latestExpiry != null) {
            member.setCurrentExpiry(latestExpiry);
        }
        memberRepository.save(member);

        evictCaches(gymId);
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
