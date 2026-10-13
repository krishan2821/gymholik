package com.gymapp.module.payment.service;

import com.gymapp.common.PagedResponse;
import com.gymapp.common.PhoneMasker;
import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.audit.service.AuditLogService;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.dashboard.service.DashboardService;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
import com.gymapp.module.member.service.SequenceService;
import com.gymapp.module.payment.dto.*;
import com.gymapp.module.payment.entity.DayClose;
import com.gymapp.module.payment.entity.Payment;
import com.gymapp.module.payment.repository.DayCloseRepository;
import com.gymapp.module.payment.repository.PaymentRepository;
import com.gymapp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PaymentService {

    public static final ZoneId KOLKATA_ZONE = ZoneId.of("Asia/Kolkata");

    private final PaymentRepository paymentRepository;
    private final MembershipRepository membershipRepository;
    private final MemberRepository memberRepository;
    private final UserRepository userRepository;
    private final SequenceService sequenceService;
    private final MongoTemplate mongoTemplate;
    private final DashboardService dashboardService;
    private final AuditLogService auditLogService;
    private final DayCloseRepository dayCloseRepository;

    // Cache per gym for 30 seconds
    private final Map<String, CachedSummary> summaryCache = new ConcurrentHashMap<>();

    private record CachedSummary(PaymentSummaryResponse data, LocalDateTime expiresAt) {}

    public void evictSummaryCache(String gymId) {
        if (gymId != null) {
            summaryCache.keySet().removeIf(k -> k.startsWith(gymId + ":"));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. GET /api/payments/summary
    // ─────────────────────────────────────────────────────────────────────────
    public PaymentSummaryResponse getSummary(String period, LocalDate from, LocalDate to) {
        if (SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access payment summary");
        }
        if (!SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Only gym owners can access payment summary");
        }

        String gymId = TenantContext.getGymId();
        String periodKey = StringUtils.hasText(period) ? period.trim().toUpperCase() : "MONTH";
        String cacheKey = gymId + ":" + periodKey + ":" + from + ":" + to;

        LocalDateTime now = LocalDateTime.now();
        CachedSummary cached = summaryCache.get(cacheKey);
        if (cached != null && now.isBefore(cached.expiresAt())) {
            return cached.data();
        }

        PaymentSummaryResponse response = computeSummary(gymId, periodKey, from, to);
        summaryCache.put(cacheKey, new CachedSummary(response, now.plusSeconds(30)));
        return response;
    }

    private PaymentSummaryResponse computeSummary(String gymId, String period, LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now(KOLKATA_ZONE);
        LocalDateTime start = null;
        LocalDateTime end = null;
        LocalDateTime prevStart = null;
        LocalDateTime prevEnd = null;
        boolean hasPrevious = false;

        if (from != null && to != null) {
            start = from.atStartOfDay();
            end = to.plusDays(1).atStartOfDay();
        } else {
            switch (period) {
                case "TODAY" -> {
                    start = today.atStartOfDay();
                    end = today.plusDays(1).atStartOfDay();
                }
                case "WEEK" -> {
                    LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                    start = weekStart.atStartOfDay();
                    end = weekStart.plusDays(7).atStartOfDay();
                    prevStart = weekStart.minusWeeks(1).atStartOfDay();
                    prevEnd = weekStart.atStartOfDay();
                    hasPrevious = true;
                }
                case "MONTH" -> {
                    LocalDate monthStart = today.withDayOfMonth(1);
                    start = monthStart.atStartOfDay();
                    end = monthStart.plusMonths(1).atStartOfDay();
                    prevStart = monthStart.minusMonths(1).atStartOfDay();
                    prevEnd = monthStart.atStartOfDay();
                    hasPrevious = true;
                }
                case "ALL" -> {
                    start = null;
                    end = null;
                }
                default -> {
                    LocalDate monthStart = today.withDayOfMonth(1);
                    start = monthStart.atStartOfDay();
                    end = monthStart.plusMonths(1).atStartOfDay();
                    prevStart = monthStart.minusMonths(1).atStartOfDay();
                    prevEnd = monthStart.atStartOfDay();
                    hasPrevious = true;
                }
            }
        }

        // Query payments in range
        Query query = new Query(Criteria.where("gymId").is(gymId));
        if (start != null && end != null) {
            query.addCriteria(Criteria.where("paidAt").gte(start).lt(end));
        }

        List<Payment> payments = mongoTemplate.find(query, Payment.class);

        long collectedPaise = 0L;
        long cashPaise = 0L;
        long upiPaise = 0L;
        long cardPaise = 0L;

        for (Payment p : payments) {
            long amt = "REVERSAL".equalsIgnoreCase(p.getType()) ? -p.getAmountPaise() : p.getAmountPaise();
            collectedPaise += amt;
            if (p.getMode() != null) {
                switch (p.getMode().toUpperCase()) {
                    case "CASH" -> cashPaise += amt;
                    case "UPI" -> upiPaise += amt;
                    case "CARD" -> cardPaise += amt;
                    default -> {}
                }
            }
        }

        Map<String, PaymentSummaryResponse.ModeSummary> byMode = new LinkedHashMap<>();
        byMode.put("CASH", buildModeSummary(cashPaise, collectedPaise));
        byMode.put("UPI", buildModeSummary(upiPaise, collectedPaise));
        byMode.put("CARD", buildModeSummary(cardPaise, collectedPaise));

        Long previousPeriodPaise = null;
        Double percentChange = null;

        if (hasPrevious && prevStart != null && prevEnd != null) {
            Query prevQuery = new Query(Criteria.where("gymId").is(gymId)
                    .and("paidAt").gte(prevStart).lt(prevEnd));
            List<Payment> prevPayments = mongoTemplate.find(prevQuery, Payment.class);
            long prevTotal = 0L;
            for (Payment p : prevPayments) {
                prevTotal += "REVERSAL".equalsIgnoreCase(p.getType()) ? -p.getAmountPaise() : p.getAmountPaise();
            }
            previousPeriodPaise = prevTotal;

            if (prevTotal == 0L) {
                percentChange = collectedPaise > 0 ? 100.0 : (collectedPaise < 0 ? -100.0 : 0.0);
            } else {
                double raw = ((double) (collectedPaise - prevTotal) / (double) prevTotal) * 100.0;
                percentChange = Math.round(raw * 10.0) / 10.0;
            }
        }

        // Pending dues of ACTIVE memberships
        Query activeDuesQuery = new Query(Criteria.where("gymId").is(gymId)
                .and("status").is("ACTIVE")
                .and("duePaise").gt(0));
        List<Membership> activeMemberships = mongoTemplate.find(activeDuesQuery, Membership.class);
        long pendingDuePaise = activeMemberships.stream()
                .mapToLong(Membership::getDuePaise)
                .sum();
        long pendingMembersCount = activeMemberships.stream()
                .map(Membership::getMemberId)
                .filter(Objects::nonNull)
                .distinct()
                .count();

        return PaymentSummaryResponse.builder()
                .collectedPaise(collectedPaise)
                .count(payments.size())
                .byMode(byMode)
                .previousPeriodPaise(previousPeriodPaise)
                .percentChange(percentChange)
                .pendingDuePaise(pendingDuePaise)
                .pendingMembersCount(pendingMembersCount)
                .build();
    }

    private PaymentSummaryResponse.ModeSummary buildModeSummary(long modePaise, long totalPaise) {
        double percent = 0.0;
        if (totalPaise > 0) {
            double raw = ((double) modePaise * 100.0) / (double) totalPaise;
            percent = Math.round(raw * 10.0) / 10.0;
        }
        return PaymentSummaryResponse.ModeSummary.builder()
                .paise(modePaise)
                .percent(percent)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. GET /api/payments
    // ─────────────────────────────────────────────────────────────────────────
    public PaymentListResponse getPayments(LocalDate startDate, LocalDate endDate, String mode, Pageable pageable) {
        return getPayments(null, startDate, endDate, mode, null, pageable);
    }

    public PaymentListResponse getPayments(
            String period,
            LocalDate startDate,
            LocalDate endDate,
            String mode,
            String search,
            Pageable pageable) {
        return getPayments(period, startDate, endDate, mode, search, null, pageable);
    }

    public PaymentListResponse getPayments(
            String period,
            LocalDate startDate,
            LocalDate endDate,
            String mode,
            String search,
            String memberId,
            Pageable pageable) {

        if (SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access payments");
        }

        String gymId = TenantContext.getGymId();
        boolean isStaff = SecurityUtils.isStaff();
        String currentUserId = SecurityUtils.getCurrentUserId();

        Query query = new Query().with(pageable);
        query.addCriteria(Criteria.where("gymId").is(gymId));

        if (StringUtils.hasText(memberId)) {
            query.addCriteria(Criteria.where("memberId").is(memberId.trim()));
        }


        // Staff sees only payments collected by that staff user, and only the last 7 days
        if (isStaff) {
            query.addCriteria(Criteria.where("receivedBy").is(currentUserId));
            LocalDate sevenDaysAgo = LocalDate.now(KOLKATA_ZONE).minusDays(7);
            query.addCriteria(Criteria.where("paidAt").gte(sevenDaysAgo.atStartOfDay()));
        }

        // Period filter if provided
        if (StringUtils.hasText(period) && !"ALL".equalsIgnoreCase(period.trim())) {
            LocalDate today = LocalDate.now(KOLKATA_ZONE);
            LocalDateTime pStart = null;
            LocalDateTime pEnd = null;

            switch (period.trim().toUpperCase()) {
                case "TODAY" -> {
                    pStart = today.atStartOfDay();
                    pEnd = today.plusDays(1).atStartOfDay();
                }
                case "WEEK" -> {
                    LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                    pStart = weekStart.atStartOfDay();
                    pEnd = weekStart.plusDays(7).atStartOfDay();
                }
                case "MONTH" -> {
                    LocalDate monthStart = today.withDayOfMonth(1);
                    pStart = monthStart.atStartOfDay();
                    pEnd = monthStart.plusMonths(1).atStartOfDay();
                }
                default -> {}
            }
            if (pStart != null && pEnd != null) {
                if (isStaff) {
                    LocalDateTime staffMin = LocalDate.now(KOLKATA_ZONE).minusDays(7).atStartOfDay();
                    LocalDateTime effectiveStart = pStart.isBefore(staffMin) ? staffMin : pStart;
                    query.addCriteria(Criteria.where("paidAt").gte(effectiveStart).lt(pEnd));
                } else {
                    query.addCriteria(Criteria.where("paidAt").gte(pStart).lt(pEnd));
                }
            }
        } else if (startDate != null && endDate != null) {
            query.addCriteria(Criteria.where("paidAt").gte(startDate.atStartOfDay()).lt(endDate.plusDays(1).atStartOfDay()));
        }

        if (StringUtils.hasText(mode)) {
            query.addCriteria(Criteria.where("mode").is(mode.toUpperCase()));
        }

        // Search on member name, member code or receipt number (escaped regex)
        if (StringUtils.hasText(search)) {
            String regex = Pattern.quote(search.trim());
            Pattern pat = Pattern.compile(regex, Pattern.CASE_INSENSITIVE);

            Query memberSearchQuery = new Query(Criteria.where("gymId").is(gymId)
                    .orOperator(
                            Criteria.where("name").regex(pat),
                            Criteria.where("memberCode").regex(pat)
                    ));
            List<Member> matchingMembers = mongoTemplate.find(memberSearchQuery, Member.class);
            Set<String> matchingMemberIds = matchingMembers.stream().map(Member::getId).collect(Collectors.toSet());

            Criteria searchCriteria = new Criteria().orOperator(
                    Criteria.where("receiptNo").regex(pat),
                    Criteria.where("memberId").in(matchingMemberIds)
            );
            query.addCriteria(searchCriteria);
        }

        List<Payment> payments = mongoTemplate.find(query, Payment.class);
        long total = mongoTemplate.count(Query.of(query).limit(-1).skip(-1), Payment.class);
        Page<Payment> page = new PageImpl<>(payments, pageable, total);

        Set<String> memberIds = payments.stream().map(Payment::getMemberId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<String> membershipIds = payments.stream().map(Payment::getMembershipId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<String> userIds = payments.stream().map(Payment::getReceivedBy).filter(Objects::nonNull).collect(Collectors.toSet());

        Map<String, Member> membersMap = memberRepository.findByGymIdAndIdIn(gymId, memberIds).stream()
                .collect(Collectors.toMap(Member::getId, m -> m));
        Map<String, Membership> membershipsMap = membershipRepository.findByGymIdAndIdIn(gymId, membershipIds).stream()
                .collect(Collectors.toMap(Membership::getId, m -> m));
        Map<String, User> usersMap = userRepository.findByGymIdAndIdIn(gymId, userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        List<PaymentResponse> content = page.getContent().stream()
                .map(p -> {
                    Member m = membersMap.get(p.getMemberId());
                    Membership ms = membershipsMap.get(p.getMembershipId());
                    User u = usersMap.get(p.getReceivedBy());

                    long displayAmount = "REVERSAL".equalsIgnoreCase(p.getType()) ? -p.getAmountPaise() : p.getAmountPaise();
                    String memberName = m != null ? m.getName() : (p.getMemberName() != null ? p.getMemberName() : "Unknown Member");
                    String memberCode = m != null ? m.getMemberCode() : null;
                    String planName = ms != null ? ms.getPlanName() : null;
                    String collectedByName = u != null ? u.getName() : "Owner";
                    String refNo = p.getReferenceNo() != null ? p.getReferenceNo() : p.getReceiptNo();

                    return PaymentResponse.builder()
                            .id(p.getId())
                            .gymId(p.getGymId())
                            .memberId(p.getMemberId())
                            .memberName(memberName)
                            .memberCode(memberCode)
                            .membershipId(p.getMembershipId())
                            .planName(planName)
                            .amountPaise(displayAmount)
                            .mode(p.getMode())
                            .paidAt(p.getPaidAt())
                            .receiptNo(p.getReceiptNo())
                            .type(p.getType())
                            .reversalOfId(p.getReversalOfId())
                            .reason(p.getReason())
                            .collectedByName(collectedByName)
                            .referenceNo(refNo)
                            .createdAt(p.getCreatedAt())
                            .build();
                })
                .toList();

        PagedResponse<PaymentResponse> pagedResponse = PagedResponse.<PaymentResponse>builder()
                .content(content)
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();

        // Calculate dayTotals for the dates in this page
        Map<String, Long> dateGrouped = new LinkedHashMap<>();
        for (PaymentResponse item : content) {
            if (item.getPaidAt() != null) {
                String dStr = item.getPaidAt().toLocalDate().toString();
                dateGrouped.put(dStr, dateGrouped.getOrDefault(dStr, 0L) + item.getAmountPaise());
            }
        }
        List<DayTotalResponse> dayTotals = dateGrouped.entrySet().stream()
                .map(e -> DayTotalResponse.builder().date(e.getKey()).totalPaise(e.getValue()).build())
                .toList();

        // Totals by mode across all matching data
        Query totalsQuery = Query.of(query).limit(-1).skip(-1);
        List<Payment> allMatching = mongoTemplate.find(totalsQuery, Payment.class);
        Map<String, Long> totalsByMode = new LinkedHashMap<>();
        totalsByMode.put("CASH", 0L);
        totalsByMode.put("UPI", 0L);
        totalsByMode.put("CARD", 0L);
        for (Payment p : allMatching) {
            if (p.getMode() != null) {
                String mKey = p.getMode().toUpperCase();
                long amt = "REVERSAL".equalsIgnoreCase(p.getType()) ? -p.getAmountPaise() : p.getAmountPaise();
                totalsByMode.put(mKey, totalsByMode.getOrDefault(mKey, 0L) + amt);
            }
        }

        return PaymentListResponse.builder()
                .payments(pagedResponse)
                .totalsByMode(totalsByMode)
                .dayTotals(dayTotals)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. GET /api/payments/{id}
    // ─────────────────────────────────────────────────────────────────────────
    public PaymentDetailResponse getPaymentDetail(String id) {
        if (SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access payment detail");
        }

        String gymId = TenantContext.getGymId();
        Payment payment = paymentRepository.findByIdAndGymId(id, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Payment not found"));

        // Staff sees only payments collected by that staff user, and only the last 7 days
        if (SecurityUtils.isStaff()) {
            String staffId = SecurityUtils.getCurrentUserId();
            LocalDate sevenDaysAgo = LocalDate.now(KOLKATA_ZONE).minusDays(7);
            if (!staffId.equals(payment.getReceivedBy()) ||
                    (payment.getPaidAt() != null && payment.getPaidAt().toLocalDate().isBefore(sevenDaysAgo))) {
                throw new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Payment not found");
            }
        }

        Member member = memberRepository.findByIdAndGymId(payment.getMemberId(), gymId).orElse(null);
        Membership membership = membershipRepository.findByIdAndGymId(payment.getMembershipId(), gymId).orElse(null);
        User collector = payment.getReceivedBy() != null ? userRepository.findByIdAndGymId(payment.getReceivedBy(), gymId).orElse(null) : null;

        PaymentDetailResponse.MembershipSummary memSummary = null;
        if (membership != null) {
            memSummary = PaymentDetailResponse.MembershipSummary.builder()
                    .id(membership.getId())
                    .planName(membership.getPlanName())
                    .totalPaise(membership.getTotalPaise())
                    .discountPaise(membership.getDiscountPaise())
                    .paidPaise(membership.getPaidPaise())
                    .duePaise(membership.getDuePaise())
                    .startDate(membership.getStartDate())
                    .expiryDate(membership.getExpiryDate())
                    .status(membership.getStatus() != null ? membership.getStatus().name() : "ACTIVE")
                    .build();
        }

        String reversalOfId = null;
        String reversalOfReceiptNo = null;
        String reversedByPaymentId = null;
        String reversalReceiptNo = null;
        LocalDateTime reversedAt = null;

        if ("REVERSAL".equalsIgnoreCase(payment.getType())) {
            reversalOfId = payment.getReversalOfId();
            if (reversalOfId != null) {
                Payment orig = paymentRepository.findByIdAndGymId(reversalOfId, gymId).orElse(null);
                if (orig != null) {
                    reversalOfReceiptNo = orig.getReceiptNo();
                }
            }
        } else {
            Optional<Payment> revOpt = paymentRepository.findByGymIdAndReversalOfId(gymId, payment.getId());
            if (revOpt.isPresent()) {
                Payment rev = revOpt.get();
                reversedByPaymentId = rev.getId();
                reversalReceiptNo = rev.getReceiptNo();
                reversedAt = rev.getPaidAt();
            }
        }

        long displayAmount = "REVERSAL".equalsIgnoreCase(payment.getType()) ? -payment.getAmountPaise() : payment.getAmountPaise();

        return PaymentDetailResponse.builder()
                .id(payment.getId())
                .receiptNo(payment.getReceiptNo())
                .gymId(payment.getGymId())
                .memberId(payment.getMemberId())
                .memberName(member != null ? member.getName() : payment.getMemberName())
                .memberCode(member != null ? member.getMemberCode() : null)
                .membershipId(payment.getMembershipId())
                .planName(membership != null ? membership.getPlanName() : null)
                .amountPaise(displayAmount)
                .mode(payment.getMode())
                .type(payment.getType())
                .paidAt(payment.getPaidAt())
                .createdAt(payment.getCreatedAt())
                .collectedByName(collector != null ? collector.getName() : "Owner")
                .collectedByUserId(payment.getReceivedBy())
                .referenceNo(payment.getReferenceNo() != null ? payment.getReferenceNo() : payment.getReceiptNo())
                .reason(payment.getReason())
                .note(payment.getNote())
                .membershipSummary(memSummary)
                .reversalOfId(reversalOfId)
                .reversalOfReceiptNo(reversalOfReceiptNo)
                .reversedByPaymentId(reversedByPaymentId)
                .reversalReceiptNo(reversalReceiptNo)
                .reversedAt(reversedAt)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. GET /api/dues
    // ─────────────────────────────────────────────────────────────────────────
    public PagedResponse<MemberDueResponse> getDues(Pageable pageable) {
        DuesListResponse listResponse = getDues("ALL", null, pageable);
        List<MemberDueResponse> mapped = listResponse.getItems().stream()
                .map(item -> MemberDueResponse.builder()
                        .memberId(item.getMemberId())
                        .memberCode(item.getMemberCode())
                        .memberName(item.getName())
                        .phone(item.getPhone())
                        .membershipId(item.getMembershipId())
                        .totalDuePaise(item.getDuePaise())
                        .build())
                .toList();

        return PagedResponse.<MemberDueResponse>builder()
                .content(mapped)
                .page(listResponse.getPage())
                .size(listResponse.getSize())
                .totalElements(listResponse.getTotalElements())
                .totalPages(listResponse.getTotalPages())
                .last(listResponse.isLast())
                .build();
    }

    public DuesListResponse getDues(String filter, String search, Pageable pageable) {
        if (SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access dues");
        }

        String gymId = TenantContext.getGymId();
        LocalDate today = LocalDate.now(KOLKATA_ZONE);

        Query query = new Query();
        query.addCriteria(Criteria.where("gymId").is(gymId).and("duePaise").gt(0));

        String filterType = StringUtils.hasText(filter) ? filter.trim().toUpperCase() : "ALL";
        switch (filterType) {
            case "OVERDUE" -> query.addCriteria(Criteria.where("expiryDate").lt(today));
            case "EXPIRING" -> query.addCriteria(Criteria.where("expiryDate").gte(today).lte(today.plusDays(7)));
            case "PARTIAL" -> query.addCriteria(Criteria.where("paidPaise").gt(0));
            case "ALL" -> {}
            default -> {}
        }

        if (StringUtils.hasText(search)) {
            String regex = Pattern.quote(search.trim());
            Pattern pat = Pattern.compile(regex, Pattern.CASE_INSENSITIVE);
            Query memberSearchQuery = new Query(Criteria.where("gymId").is(gymId)
                    .orOperator(
                            Criteria.where("name").regex(pat),
                            Criteria.where("memberCode").regex(pat),
                            Criteria.where("phone").regex(pat)
                    ));
            List<Member> matchingMembers = mongoTemplate.find(memberSearchQuery, Member.class);
            Set<String> matchingMemberIds = matchingMembers.stream().map(Member::getId).collect(Collectors.toSet());

            if (matchingMemberIds.isEmpty()) {
                return DuesListResponse.builder()
                        .items(List.of())
                        .content(List.of())
                        .totalDuePaise(0L)
                        .count(0L)
                        .page(pageable.getPageNumber())
                        .size(pageable.getPageSize())
                        .totalElements(0L)
                        .totalPages(0)
                        .last(true)
                        .build();
            }
            query.addCriteria(Criteria.where("memberId").in(matchingMemberIds));
        }

        // Calculate totalDuePaise and count over all matching items
        List<Membership> allMatching = mongoTemplate.find(Query.of(query), Membership.class);
        long totalDuePaise = allMatching.stream().mapToLong(Membership::getDuePaise).sum();
        long totalElements = allMatching.size();

        // Sort by due descending, then by most overdue (earliest expiry date first)
        query.with(Sort.by(Sort.Order.desc("duePaise"), Sort.Order.asc("expiryDate")));
        query.with(pageable);

        List<Membership> pageMemberships = mongoTemplate.find(query, Membership.class);

        Set<String> memberIds = pageMemberships.stream().map(Membership::getMemberId).collect(Collectors.toSet());
        Map<String, Member> memberMap = memberRepository.findByGymIdAndIdIn(gymId, memberIds).stream()
                .collect(Collectors.toMap(Member::getId, m -> m));

        boolean isStaff = SecurityUtils.isStaff();

        List<DueItemResponse> items = pageMemberships.stream()
                .filter(m -> memberMap.containsKey(m.getMemberId()))
                .map(m -> {
                    Member member = memberMap.get(m.getMemberId());
                    String phone = isStaff ? PhoneMasker.mask(member.getPhone()) : member.getPhone();

                    LocalDate expDate = m.getExpiryDate();
                    Long daysOverdue = null;
                    Long daysToExpiry = null;
                    if (expDate != null) {
                        if (expDate.isBefore(today)) {
                            daysOverdue = ChronoUnit.DAYS.between(expDate, today);
                        } else {
                            daysToExpiry = ChronoUnit.DAYS.between(today, expDate);
                        }
                    }

                    // Last payment date
                    List<Payment> memPayments = paymentRepository.findByGymIdAndMembershipId(gymId, m.getId());
                    LocalDateTime lastPaymentAt = memPayments.stream()
                            .map(Payment::getPaidAt)
                            .filter(Objects::nonNull)
                            .max(LocalDateTime::compareTo)
                            .orElse(null);

                    LocalDate promisedDate = m.getPromisedDate();
                    Boolean promiseBroken = (promisedDate != null && promisedDate.isBefore(today) && m.getDuePaise() > 0);

                    return DueItemResponse.builder()
                            .memberId(member.getId())
                            .name(member.getName())
                            .memberName(member.getName())
                            .memberCode(member.getMemberCode())
                            .phone(phone)
                            .membershipId(m.getId())
                            .planName(m.getPlanName())
                            .duePaise(m.getDuePaise())
                            .totalDuePaise(m.getDuePaise())
                            .totalPaise(m.getTotalPaise())
                            .paidPaise(m.getPaidPaise())
                            .expiryDate(expDate)
                            .daysOverdue(daysOverdue)
                            .daysToExpiry(daysToExpiry)
                            .lastPaymentAt(lastPaymentAt)
                            .promisedDate(promisedDate)
                            .promiseBroken(promiseBroken)
                            .build();
                })
                .toList();

        int totalPages = pageable.getPageSize() > 0 ? (int) Math.ceil((double) totalElements / pageable.getPageSize()) : 0;

        return DuesListResponse.builder()
                .items(items)
                .content(items)
                .totalDuePaise(totalDuePaise)
                .count(totalElements)
                .page(pageable.getPageNumber())
                .size(pageable.getPageSize())
                .totalElements(totalElements)
                .totalPages(totalPages)
                .last(pageable.getPageNumber() >= totalPages - 1)
                .build();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Create & Reverse Payment
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional
    public PaymentResponse createPayment(CreatePaymentRequest request) {
        if (SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access payments");
        }

        String gymId = TenantContext.getGymId();

        if (StringUtils.hasText(request.getIdempotencyKey())) {
            Optional<Payment> existing = paymentRepository.findByGymIdAndIdempotencyKey(gymId, request.getIdempotencyKey());
            if (existing.isPresent()) {
                return mapToResponse(existing.get());
            }
        }

        if (request.getAmountPaise() == null || request.getAmountPaise() <= 0) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Payment amount must be greater than zero");
        }

        Member member = memberRepository.findByIdAndGymId(request.getMemberId(), gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));

        Membership membership = membershipRepository.findByIdAndGymId(request.getMembershipId(), gymId)
                .filter(m -> m.getMemberId().equals(member.getId()))
                .orElseThrow(() -> new AppException(ErrorCode.MEMBERSHIP_NOT_FOUND));

        if (request.getAmountPaise() > membership.getDuePaise()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Payment amount exceeds due amount");
        }

        if (request.getReferenceNo() != null && request.getReferenceNo().length() > 40) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Reference number cannot exceed 40 characters");
        }

        LocalDate todayKolkata = LocalDate.now(KOLKATA_ZONE);
        LocalDate businessDate = request.getReceivedAt() != null ? request.getReceivedAt() : request.getPaymentDate();
        if (businessDate == null) {
            businessDate = todayKolkata;
        }

        if (businessDate.isAfter(todayKolkata)) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Payment date cannot be in the future");
        }

        boolean isBackdated = businessDate.isBefore(todayKolkata);
        if (isBackdated) {
            if (!SecurityUtils.isOwner()) {
                throw new AppException(ErrorCode.ACCESS_DENIED, "Only owners can record backdated payments");
            }
            if (businessDate.isBefore(todayKolkata.minusDays(31))) {
                throw new AppException(ErrorCode.VALIDATION_ERROR, "Payment cannot be backdated more than 31 days");
            }
        }

        String receiptNo = sequenceService.generateNextReceiptNo(gymId);
        String currentUserId = SecurityUtils.getCurrentUserId();

        Payment payment = Payment.builder()
                .gymId(gymId)
                .memberId(member.getId())
                .membershipId(membership.getId())
                .amountPaise(request.getAmountPaise())
                .mode(request.getMode())
                .paidAt(businessDate.atStartOfDay())
                .receivedAt(businessDate.atStartOfDay())
                .receiptNo(receiptNo)
                .type("PAYMENT")
                .reason(request.getReason())
                .receivedBy(currentUserId)
                .referenceNo(request.getReferenceNo() != null ? request.getReferenceNo() : receiptNo)
                .build();

        payment.setIdempotencyKey(request.getIdempotencyKey());
        payment = paymentRepository.save(payment);

        if (isBackdated) {
            // Audit entry: PAYMENT_BACKDATED (amount and date only, no personal data)
            auditLogService.log("PAYMENT_BACKDATED", payment.getId(), "{\"amountPaise\":" + payment.getAmountPaise() + ",\"receivedAt\":\"" + businessDate + "\"}");
        }

        Update update = new Update()
                .inc("paidPaise", request.getAmountPaise())
                .inc("duePaise", -request.getAmountPaise());

        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(membership.getId()).and("gymId").is(gymId)),
                update,
                Membership.class
        );

        mongoTemplate.updateFirst(
                new Query(Criteria.where("_id").is(member.getId()).and("gymId").is(gymId)),
                new Update().inc("currentDuePaise", -request.getAmountPaise()),
                Member.class
        );

        evictSummaryCache(gymId);
        if (dashboardService != null) {
            dashboardService.evictCache(gymId);
        }

        return mapToResponse(payment, member.getName(), member.getMemberCode(), membership.getPlanName());
    }

    @Transactional
    public PaymentResponse reversePayment(String paymentId, ReversePaymentRequest request) {
        if (!SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Only owners can reverse payments");
        }

        if (request == null || request.getReasonCode() == null) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Reason code is required");
        }

        if (request.getNote() == null || request.getNote().trim().length() < 5 || request.getNote().trim().length() > 300) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Note must be between 5 and 300 characters");
        }

        String gymId = TenantContext.getGymId();
        Payment originalPayment = paymentRepository.findByIdAndGymId(paymentId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Payment not found"));

        if ("REVERSAL".equalsIgnoreCase(originalPayment.getType()) || originalPayment.getReversalOfId() != null) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "A reversal payment cannot be reversed");
        }

        Optional<Payment> existingRev = paymentRepository.findByGymIdAndReversalOfId(gymId, paymentId);
        if (existingRev.isPresent()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Payment already reversed");
        }

        String receiptNo = sequenceService.generateNextReceiptNo(gymId);
        String currentUserId = SecurityUtils.getCurrentUserId();

        Payment reversal = Payment.builder()
                .gymId(gymId)
                .memberId(originalPayment.getMemberId())
                .membershipId(originalPayment.getMembershipId())
                .amountPaise(originalPayment.getAmountPaise())
                .mode(originalPayment.getMode())
                .paidAt(LocalDate.now(KOLKATA_ZONE).atStartOfDay())
                .receivedAt(LocalDate.now(KOLKATA_ZONE).atStartOfDay())
                .receiptNo(receiptNo)
                .type("REVERSAL")
                .reversalOfId(originalPayment.getId())
                .receivedBy(currentUserId)
                .referenceNo(originalPayment.getReceiptNo())
                .reason(request.getReasonCode().name())
                .reasonCode(request.getReasonCode().name())
                .note(request.getNote().trim())
                .build();

        reversal = paymentRepository.save(reversal);

        Membership membership = membershipRepository.findByIdAndGymId(originalPayment.getMembershipId(), gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBERSHIP_NOT_FOUND));

        membership.setPaidPaise(membership.getPaidPaise() - originalPayment.getAmountPaise());
        long restoredDue = Math.max(0, membership.getTotalPaise() - membership.getDiscountPaise() - membership.getPaidPaise());
        membership.setDuePaise(restoredDue);
        membershipRepository.save(membership);

        Member member = memberRepository.findByIdAndGymId(originalPayment.getMemberId(), gymId).orElse(null);
        if (member != null) {
            List<Membership> memberMemberships = membershipRepository.findByGymIdAndMemberId(gymId, member.getId());
            long totalMemberDue = memberMemberships.stream().mapToLong(Membership::getDuePaise).sum();
            member.setCurrentDuePaise(Math.max(0, totalMemberDue));
            memberRepository.save(member);
        }

        // Audit entry: PAYMENT_REVERSED (amount and reason code only, no personal data)
        auditLogService.log("PAYMENT_REVERSED", originalPayment.getId(),
                "{\"amountPaise\":" + originalPayment.getAmountPaise() + ",\"reasonCode\":\"" + request.getReasonCode().name() + "\"}");

        evictSummaryCache(gymId);
        if (dashboardService != null) {
            dashboardService.evictCache(gymId);
        }

        return mapToResponse(reversal, member != null ? member.getName() : null, member != null ? member.getMemberCode() : null, membership.getPlanName());
    }

    @Transactional
    public PaymentResponse reversePayment(String paymentId, String notes) {
        ReversePaymentRequest req = new ReversePaymentRequest();
        req.setReasonCode(ReversalReasonCode.OTHER);
        req.setNote(StringUtils.hasText(notes) ? notes : "Payment reversal requested");
        return reversePayment(paymentId, req);
    }

    public Payment getPaymentEntityById(String id) {
        if (SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access payment receipts");
        }

        String gymId = TenantContext.getGymId();
        return paymentRepository.findByIdAndGymId(id, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Payment not found"));
    }

    private PaymentResponse mapToResponse(Payment payment) {
        Member member = memberRepository.findByIdAndGymId(payment.getMemberId(), payment.getGymId()).orElse(null);
        Membership membership = membershipRepository.findByIdAndGymId(payment.getMembershipId(), payment.getGymId()).orElse(null);
        return mapToResponse(payment, member != null ? member.getName() : "Unknown Member", member != null ? member.getMemberCode() : null, membership != null ? membership.getPlanName() : null);
    }

    private PaymentResponse mapToResponse(Payment payment, String memberName, String memberCode, String planName) {
        long displayAmount = "REVERSAL".equalsIgnoreCase(payment.getType()) ? -payment.getAmountPaise() : payment.getAmountPaise();
        User collector = payment.getReceivedBy() != null ? userRepository.findByIdAndGymId(payment.getReceivedBy(), payment.getGymId()).orElse(null) : null;

        return PaymentResponse.builder()
                .id(payment.getId())
                .gymId(payment.getGymId())
                .memberId(payment.getMemberId())
                .memberName(memberName)
                .memberCode(memberCode)
                .membershipId(payment.getMembershipId())
                .planName(planName)
                .amountPaise(displayAmount)
                .mode(payment.getMode())
                .paidAt(payment.getPaidAt())
                .receiptNo(payment.getReceiptNo())
                .type(payment.getType())
                .reversalOfId(payment.getReversalOfId())
                .reason(payment.getReason())
                .collectedByName(collector != null ? collector.getName() : "Owner")
                .referenceNo(payment.getReferenceNo() != null ? payment.getReferenceNo() : payment.getReceiptNo())
                .createdAt(payment.getCreatedAt())
                .build();
    }

    public DayCloseReportResponse getDayCloseReport(LocalDate date) {
        if (!SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Only owners can access day-close reports");
        }

        String gymId = TenantContext.getGymId();
        LocalDate targetDate = date != null ? date : LocalDate.now(KOLKATA_ZONE);
        LocalDateTime startOfDay = targetDate.atStartOfDay();
        LocalDateTime endOfDay = targetDate.plusDays(1).atStartOfDay();
        Query query = new Query(Criteria.where("gymId").is(gymId)
                .and("paidAt").gte(startOfDay).lt(endOfDay));
        List<Payment> payments = mongoTemplate.find(query, Payment.class);

        long totalCollectedPaise = 0;
        long reversalsPaise = 0;
        long reversalsCount = 0;
        long regularCount = 0;

        Map<String, Long> byMode = new LinkedHashMap<>();
        byMode.put("CASH", 0L);
        byMode.put("UPI", 0L);
        byMode.put("CARD", 0L);

        Map<String, long[]> staffMap = new HashMap<>(); // staffId -> [amountPaise, count]

        for (Payment p : payments) {
            boolean isReversal = "REVERSAL".equalsIgnoreCase(p.getType());
            long netAmount = isReversal ? -p.getAmountPaise() : p.getAmountPaise();

            if (isReversal) {
                reversalsCount++;
                reversalsPaise += p.getAmountPaise();
            } else {
                regularCount++;
            }

            totalCollectedPaise += netAmount;

            String mode = p.getMode() != null ? p.getMode().toUpperCase() : "CASH";
            byMode.put(mode, byMode.getOrDefault(mode, 0L) + netAmount);

            String staffId = p.getReceivedBy() != null ? p.getReceivedBy() : "OWNER";
            long[] staffStat = staffMap.computeIfAbsent(staffId, k -> new long[2]);
            staffStat[0] += netAmount;
            staffStat[1]++;
        }

        long expectedCashPaise = byMode.getOrDefault("CASH", 0L);

        // Build staff breakdown
        List<StaffBreakdownResponse> staffBreakdown = new ArrayList<>();
        for (Map.Entry<String, long[]> entry : staffMap.entrySet()) {
            String staffId = entry.getKey();
            long amount = entry.getValue()[0];
            long count = entry.getValue()[1];

            String staffName = "Owner";
            if (!"OWNER".equals(staffId)) {
                User user = userRepository.findByIdAndGymId(staffId, gymId).orElse(null);
                if (user != null) {
                    staffName = user.getName();
                }
            }

            staffBreakdown.add(StaffBreakdownResponse.builder()
                    .staffId(staffId)
                    .name(staffName)
                    .amountPaise(amount)
                    .count(count)
                    .build());
        }

        Optional<DayClose> existingClose = dayCloseRepository.findByGymIdAndDate(gymId, targetDate);

        return DayCloseReportResponse.builder()
                .date(targetDate)
                .totalCollectedPaise(totalCollectedPaise)
                .count(regularCount)
                .reversalsCount(reversalsCount)
                .reversalsPaise(reversalsPaise)
                .byMode(byMode)
                .expectedCashPaise(expectedCashPaise)
                .staffBreakdown(staffBreakdown)
                .isClosed(existingClose.isPresent())
                .dayClose(existingClose.orElse(null))
                .build();
    }

    @Transactional
    public DayClose submitDayClose(SubmitDayCloseRequest request) {
        if (!SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Only owners can submit day-close");
        }

        String gymId = TenantContext.getGymId();
        LocalDate date = request.getDate();
        if (date == null) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Date is required");
        }

        if (dayCloseRepository.existsByGymIdAndDate(gymId, date)) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Day close already submitted for " + date + " and cannot be edited");
        }

        DayCloseReportResponse report = getDayCloseReport(date);
        long expectedCashPaise = report.getExpectedCashPaise();
        long countedCashPaise = request.getCountedCashPaise() != null ? request.getCountedCashPaise() : 0L;
        long differencePaise = countedCashPaise - expectedCashPaise;

        String closedBy = SecurityUtils.getCurrentUserId();

        DayClose dayClose = DayClose.builder()
                .gymId(gymId)
                .date(date)
                .expectedCashPaise(expectedCashPaise)
                .countedCashPaise(countedCashPaise)
                .differencePaise(differencePaise)
                .closedBy(closedBy)
                .note(request.getNote())
                .build();

        DayClose saved = dayCloseRepository.save(dayClose);

        auditLogService.log("DAY_CLOSED", saved.getId(),
                "Day closed for " + date + ": expected=" + expectedCashPaise + ", counted=" + countedCashPaise + ", diff=" + differencePaise);

        return saved;
    }
}
