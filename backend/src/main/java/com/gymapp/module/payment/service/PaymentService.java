package com.gymapp.module.payment.service;

import com.gymapp.common.PagedResponse;
import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
import com.gymapp.module.member.service.SequenceService;
import com.gymapp.module.payment.dto.CreatePaymentRequest;
import com.gymapp.module.payment.dto.MemberDueResponse;
import com.gymapp.module.payment.dto.PaymentResponse;
import com.gymapp.module.payment.entity.Payment;

import com.gymapp.module.payment.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final MembershipRepository membershipRepository;
    private final MemberRepository memberRepository;
    private final SequenceService sequenceService;
    private final MongoTemplate mongoTemplate;

    @Transactional
    public PaymentResponse createPayment(CreatePaymentRequest request) {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access payments");
        }

        String gymId = TenantContext.getGymId();

        if (StringUtils.hasText(request.getIdempotencyKey()) && 
            paymentRepository.existsByGymIdAndIdempotencyKey(gymId, request.getIdempotencyKey())) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Payment already processed");
        }

        if (request.getAmountPaise() <= 0) {
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

        String receiptNo = sequenceService.generateNextReceiptNo(gymId);
        LocalDate paymentDate = request.getPaymentDate() != null ? request.getPaymentDate() : LocalDate.now();

        Payment payment = Payment.builder()
                .gymId(gymId)
                .memberId(member.getId())
                .membershipId(membership.getId())
                .amountPaise(request.getAmountPaise())
                .mode(request.getMode())
                .paidAt(paymentDate.atStartOfDay())
                .receiptNo(receiptNo)
                .type("PAYMENT")
                .reason(request.getReason())
                .build();

        payment.setIdempotencyKey(request.getIdempotencyKey());
        payment = paymentRepository.save(payment);

        org.springframework.data.mongodb.core.query.Update update = new org.springframework.data.mongodb.core.query.Update()
                .inc("paidPaise", request.getAmountPaise())
                .inc("duePaise", -request.getAmountPaise());

        mongoTemplate.updateFirst(
                new org.springframework.data.mongodb.core.query.Query(
                        Criteria.where("_id").is(membership.getId()).and("gymId").is(gymId)
                ),
                update,
                Membership.class
        );

        mongoTemplate.updateFirst(
                new org.springframework.data.mongodb.core.query.Query(
                        Criteria.where("_id").is(member.getId()).and("gymId").is(gymId)
                ),
                new org.springframework.data.mongodb.core.query.Update().inc("currentDuePaise", -request.getAmountPaise()),
                Member.class
        );

        return mapToResponse(payment);
    }

    public com.gymapp.module.payment.dto.PaymentListResponse getPayments(LocalDate startDate, LocalDate endDate, String mode, Pageable pageable) {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access payments");
        }

        String gymId = TenantContext.getGymId();
        
        org.springframework.data.mongodb.core.query.Query query = new org.springframework.data.mongodb.core.query.Query().with(pageable);
        query.addCriteria(Criteria.where("gymId").is(gymId));

        if (StringUtils.hasText(mode)) {
            query.addCriteria(Criteria.where("mode").is(mode));
        }
        if (startDate != null && endDate != null) {
            query.addCriteria(Criteria.where("paidAt").gte(startDate.atStartOfDay()).lt(endDate.plusDays(1).atStartOfDay()));
        }

        List<Payment> payments = mongoTemplate.find(query, Payment.class);
        long total = mongoTemplate.count(org.springframework.data.mongodb.core.query.Query.of(query).limit(-1).skip(-1), Payment.class);
        Page<Payment> page = new org.springframework.data.domain.PageImpl<>(payments, pageable, total);

        Set<String> memberIds = payments.stream().map(Payment::getMemberId).collect(Collectors.toSet());
        Map<String, String> memberNames = memberRepository.findByGymIdAndIdIn(gymId, memberIds).stream()
                .collect(Collectors.toMap(com.gymapp.module.member.entity.Member::getId, com.gymapp.module.member.entity.Member::getName));

        List<PaymentResponse> content = page.getContent().stream()
                .map(p -> mapToResponse(p, memberNames.getOrDefault(p.getMemberId(), "Unknown Member")))
                .toList();

        PagedResponse<PaymentResponse> pagedResponse = PagedResponse.<PaymentResponse>builder()
                .content(content)
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();

        // Calculate totals across ALL filtered data (not just this page)
        Aggregation agg = Aggregation.newAggregation(
                Aggregation.match(org.springframework.data.mongodb.core.query.Query.of(query).limit(-1).skip(-1).getQueryObject() != null ? 
                        Criteria.where("gymId").is(gymId) : // Need proper criteria here
                        Criteria.where("gymId").is(gymId)), // Rebuild match for aggregation
                Aggregation.group("mode").sum("amountPaise").as("totalAmount")
        );
        
        // Actually let's just build the match operation clearly
        Criteria matchCriteria = Criteria.where("gymId").is(gymId);
        if (StringUtils.hasText(mode)) {
            matchCriteria.and("mode").is(mode);
        }
        if (startDate != null && endDate != null) {
            matchCriteria.andOperator(Criteria.where("paidAt").gte(startDate.atStartOfDay()).lt(endDate.plusDays(1).atStartOfDay()));
        }

        Aggregation agg2 = Aggregation.newAggregation(
                Aggregation.match(matchCriteria),
                Aggregation.group("mode").sum("amountPaise").as("totalAmount")
        );

        AggregationResults<org.bson.Document> results = mongoTemplate.aggregate(agg2, "payments", org.bson.Document.class);
        
        Map<String, Long> totalsByMode = results.getMappedResults().stream()
                .collect(Collectors.toMap(
                        doc -> doc.getString("_id"),
                        doc -> ((Number) doc.get("totalAmount")).longValue()
                ));

        return com.gymapp.module.payment.dto.PaymentListResponse.builder()
                .payments(pagedResponse)
                .totalsByMode(totalsByMode)
                .build();
    }

    public PagedResponse<MemberDueResponse> getDues(Pageable pageable) {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access dues");
        }

        String gymId = TenantContext.getGymId();
        
        // Count total dues for pagination
        long totalElements = mongoTemplate.count(
                new org.springframework.data.mongodb.core.query.Query(Criteria.where("gymId").is(gymId).and("duePaise").gt(0)),
                "memberships"
        );

        if (totalElements == 0) {
            return PagedResponse.<MemberDueResponse>builder().content(List.of()).build();
        }

        // Find memberships with duePaise > 0
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("gymId").is(gymId).and("duePaise").gt(0)),
                Aggregation.sort(Sort.Direction.DESC, "duePaise"),
                Aggregation.skip(pageable.getOffset()),
                Aggregation.limit(pageable.getPageSize())
        );

        AggregationResults<Membership> results = mongoTemplate.aggregate(aggregation, "memberships", Membership.class);
        List<Membership> membershipsWithDues = results.getMappedResults();

        List<String> memberIds = membershipsWithDues.stream()
                .map(Membership::getMemberId)
                .distinct()
                .toList();

        // Fetch members to enrich response
        Map<String, Member> memberMap = memberRepository.findByGymIdAndIdIn(gymId, memberIds).stream()
                .collect(Collectors.toMap(Member::getId, m -> m));

        boolean isOwner = com.gymapp.security.SecurityUtils.isOwner();
        boolean isStaff = com.gymapp.security.SecurityUtils.isStaff();
        boolean staffCanSeeFull = false;
        if (isStaff) {
            com.gymapp.module.auth.entity.Gym gym = mongoTemplate.findById(
                    gymId, com.gymapp.module.auth.entity.Gym.class);
            if (gym != null && gym.isStaffCanSeeFullPhone()) {
                staffCanSeeFull = true;
            }
        }
        final boolean canSeePhone = isOwner || staffCanSeeFull;

        List<MemberDueResponse> content = membershipsWithDues.stream()
                .filter(m -> memberMap.containsKey(m.getMemberId()))
                .map(m -> {
                    Member member = memberMap.get(m.getMemberId());
                    String phone = canSeePhone ? member.getPhone() : com.gymapp.common.PhoneMasker.mask(member.getPhone());
                    return MemberDueResponse.builder()
                            .memberId(member.getId())
                            .memberCode(member.getMemberCode())
                            .memberName(member.getName())
                            .phone(phone)
                            .membershipId(m.getId())
                            .totalDuePaise(m.getDuePaise())
                            .build();
                })
                .toList();

        int totalPages = (int) Math.ceil((double) totalElements / pageable.getPageSize());

        return PagedResponse.<MemberDueResponse>builder()
                .content(content)
                .page(pageable.getPageNumber())
                .size(pageable.getPageSize())
                .totalElements(totalElements)
                .totalPages(totalPages)
                .last(pageable.getPageNumber() >= totalPages - 1)
                .build();
    }

    @Transactional
    public PaymentResponse reversePayment(String paymentId, String notes) {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot reverse payments");
        }

        String gymId = TenantContext.getGymId();
        Payment originalPayment = paymentRepository.findByIdAndGymId(paymentId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Payment not found"));

        if ("REVERSAL".equals(originalPayment.getType())) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Cannot reverse a reversal payment");
        }

        // Check if already reversed
        // We can just create a reversal entry.
        String receiptNo = sequenceService.generateNextReceiptNo(gymId);

        Payment reversal = Payment.builder()
                .gymId(gymId)
                .memberId(originalPayment.getMemberId())
                .membershipId(originalPayment.getMembershipId())
                .amountPaise(originalPayment.getAmountPaise())
                .mode(originalPayment.getMode())
                .paidAt(LocalDate.now().atStartOfDay())
                .receiptNo(receiptNo)
                .type("REVERSAL")
                .reversalOfId(originalPayment.getId())
                .reason(StringUtils.hasText(notes) ? notes : "Reversal of " + originalPayment.getReceiptNo())
                .build();

        reversal = paymentRepository.save(reversal);

        // Revert membership amounts
        Membership membership = membershipRepository.findByIdAndGymId(originalPayment.getMembershipId(), gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBERSHIP_NOT_FOUND));

        org.springframework.data.mongodb.core.query.Update update = new org.springframework.data.mongodb.core.query.Update()
                .inc("paidPaise", -originalPayment.getAmountPaise())
                .inc("duePaise", originalPayment.getAmountPaise());

        mongoTemplate.updateFirst(
                new org.springframework.data.mongodb.core.query.Query(
                        Criteria.where("_id").is(membership.getId()).and("gymId").is(gymId)
                ),
                update,
                Membership.class
        );

        return mapToResponse(reversal);
    }
    
    public Payment getPaymentEntityById(String id) {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access payment receipts");
        }

        String gymId = TenantContext.getGymId();
        return paymentRepository.findByIdAndGymId(id, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Payment not found"));
    }

    private PaymentResponse mapToResponse(Payment payment) {
        String memberName = memberRepository.findByIdAndGymId(payment.getMemberId(), payment.getGymId())
                .map(com.gymapp.module.member.entity.Member::getName)
                .orElse("Unknown Member");
        return mapToResponse(payment, memberName);
    }

    private PaymentResponse mapToResponse(Payment payment, String memberName) {

        return PaymentResponse.builder()
                .id(payment.getId())
                .gymId(payment.getGymId())
                .memberId(payment.getMemberId())
                .memberName(memberName)
                .membershipId(payment.getMembershipId())
                .amountPaise(payment.getAmountPaise())
                .mode(payment.getMode())
                .paidAt(payment.getPaidAt())
                .receiptNo(payment.getReceiptNo())
                .type(payment.getType())
                .reversalOfId(payment.getReversalOfId())
                .reason(payment.getReason())
                .createdAt(payment.getCreatedAt())
                .build();
    }
}
