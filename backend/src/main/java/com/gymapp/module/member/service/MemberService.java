package com.gymapp.module.member.service;

import com.gymapp.common.PagedResponse;
import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.member.dto.CreateMemberRequest;
import com.gymapp.module.member.dto.MemberResponse;
import com.gymapp.module.member.dto.MembershipResponse;
import com.gymapp.module.member.dto.RenewMembershipRequest;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
import com.gymapp.module.plan.entity.Plan;
import com.gymapp.module.plan.repository.PlanRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;

import com.gymapp.module.audit.service.AuditLogService;
import com.gymapp.module.member.dto.ApplyDiscountRequest;
import com.gymapp.module.member.dto.UpdatePromisedDateRequest;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MemberService {

    private final MemberRepository memberRepository;
    private final MembershipRepository membershipRepository;
    private final PlanRepository planRepository;
    private final SequenceService sequenceService;
    private final MongoTemplate mongoTemplate;
    private final com.gymapp.module.trainer.repository.TrainerAssignmentRepository trainerAssignmentRepository;
    private final com.gymapp.module.trainer.service.TrainerAssignmentService trainerAssignmentService;
    private final com.gymapp.module.dashboard.service.DashboardService dashboardService;
    private final AuditLogService auditLogService;
    private final MembershipLedgerService membershipLedgerService;
    @org.springframework.context.annotation.Lazy
    private final com.gymapp.module.payment.service.PaymentService paymentService;
    private final java.time.Clock clock;

    @Transactional
    public MemberResponse createMember(CreateMemberRequest request) {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot create members");
        }

        String gymId = TenantContext.getGymId();

        if (memberRepository.existsByGymIdAndPhone(gymId, request.getPhone())) {
            throw new AppException(ErrorCode.MEMBER_PHONE_EXISTS);
        }

        Plan plan = planRepository.findByIdAndGymId(request.getPlanId(), gymId)
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_FOUND));

        String memberCode = sequenceService.generateNextMemberCode(gymId);

        LocalDate today = LocalDate.now(clock);
        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : today;
        LocalDate expiryDate = startDate.plusDays(plan.getDurationDays());
        long planPricePaise = plan.getPricePaise();

        long initialPaid = request.getPaidAmount() != null ? request.getPaidAmount() : 0L;
        if (initialPaid < 0) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Paid amount cannot be negative");
        }
        if (initialPaid > planPricePaise) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Paid amount cannot exceed plan price");
        }
        long initialDue = planPricePaise - initialPaid;

        Membership.MembershipStatus initialStatus = startDate.isAfter(today)
                ? Membership.MembershipStatus.UPCOMING
                : Membership.MembershipStatus.ACTIVE;

        Member member = Member.builder()
                .gymId(gymId)
                .memberCode(memberCode)
                .name(request.getName())
                .phone(request.getPhone())
                .gender(request.getGender())
                .dob(request.getDob())
                .address(request.getAddress())
                .status("ACTIVE")
                .joiningDate(startDate)
                .currentExpiry(expiryDate)
                .currentDuePaise(initialDue)
                .build();
        member = memberRepository.save(member);

        Membership membership = Membership.builder()
                .gymId(gymId)
                .memberId(member.getId())
                .planId(plan.getId())
                .planName(plan.getName())
                .totalPaise(planPricePaise)
                .paidPaise(initialPaid)
                .duePaise(initialDue)
                .startDate(startDate)
                .expiryDate(expiryDate)
                .status(initialStatus)
                .build();
        membership = membershipRepository.save(membership);

        if (initialPaid > 0) {
            String receiptNo = sequenceService.generateNextReceiptNo(gymId);
            String currentUserId = com.gymapp.security.SecurityUtils.getCurrentUserId();
            com.gymapp.module.payment.entity.Payment initialPayment = com.gymapp.module.payment.entity.Payment.builder()
                    .gymId(gymId)
                    .memberId(member.getId())
                    .membershipId(membership.getId())
                    .amountPaise(initialPaid)
                    .mode(StringUtils.hasText(request.getPaymentMode()) ? request.getPaymentMode() : "CASH")
                    .paidAt(java.time.LocalDateTime.now(clock))
                    .receivedAt(java.time.LocalDateTime.now(clock))
                    .receiptNo(receiptNo)
                    .type("PAYMENT")
                    .receivedBy(currentUserId)
                    .reason("Initial membership payment")
                    .build();
            mongoTemplate.save(initialPayment);
        }

        membershipLedgerService.recalculate(gymId, member.getId());
        member = memberRepository.findByIdAndGymId(member.getId(), gymId).orElse(member);
        membership = membershipRepository.findByIdAndGymId(membership.getId(), gymId).orElse(membership);

        return mapToResponse(member, membership);
    }

    public PagedResponse<MemberResponse> getMembers(String search, String status, Pageable pageable) {
        String gymId = TenantContext.getGymId();
        
        org.springframework.data.mongodb.core.query.Query query = new org.springframework.data.mongodb.core.query.Query().with(pageable);
        query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("gymId").is(gymId));

        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            String trainerId = com.gymapp.security.SecurityUtils.getCurrentUserId();
            List<com.gymapp.module.trainer.entity.TrainerAssignment> assignments =
                    trainerAssignmentRepository.findByGymIdAndTrainerIdAndStatus(gymId, trainerId, "ACTIVE");
            List<String> assignedMemberIds = assignments.stream()
                    .map(com.gymapp.module.trainer.entity.TrainerAssignment::getMemberId)
                    .toList();

            if (assignedMemberIds.isEmpty()) {
                return PagedResponse.<MemberResponse>builder()
                        .content(List.of())
                        .page(pageable.getPageNumber())
                        .size(pageable.getPageSize())
                        .totalElements(0)
                        .totalPages(0)
                        .last(true)
                        .build();
            }
            query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("id").in(assignedMemberIds));
            // Trainers can only read active members that have an active assignment
            query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status").is("ACTIVE"));
        }
        
        if (org.springframework.util.StringUtils.hasText(search)) {
            org.springframework.data.mongodb.core.query.Criteria searchCriteria = new org.springframework.data.mongodb.core.query.Criteria().orOperator(
                org.springframework.data.mongodb.core.query.Criteria.where("name").regex(search, "i"),
                org.springframework.data.mongodb.core.query.Criteria.where("phone").regex(search, "i"),
                org.springframework.data.mongodb.core.query.Criteria.where("memberCode").regex(search, "i")
            );
            query.addCriteria(searchCriteria);
        }

        if (org.springframework.util.StringUtils.hasText(status) && !"All".equalsIgnoreCase(status)) {
            if ("Active".equalsIgnoreCase(status)) {
                if (!com.gymapp.security.SecurityUtils.isTrainer()) {
                    List<String> activeMemberIds = mongoTemplate.findDistinct(
                            new org.springframework.data.mongodb.core.query.Query(
                                    org.springframework.data.mongodb.core.query.Criteria.where("gymId").is(gymId)
                                            .and("status").is(Membership.MembershipStatus.ACTIVE.name())),
                            "memberId", "memberships", String.class);
                    query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("id").in(activeMemberIds));
                }
            } else if ("Expired".equalsIgnoreCase(status)) {
                query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("currentExpiry").lt(LocalDate.now(clock)));
            } else if ("Due".equalsIgnoreCase(status)) {
                // Trainers get NO access to dues information or due filters
                if (!com.gymapp.security.SecurityUtils.isTrainer()) {
                    query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("currentDuePaise").gt(0));
                }
            }
        }

        List<Member> members = mongoTemplate.find(query, Member.class);
        long total = mongoTemplate.count(org.springframework.data.mongodb.core.query.Query.of(query).limit(-1).skip(-1), Member.class);
        Page<Member> membersPage = new org.springframework.data.domain.PageImpl<>(members, pageable, total);

        List<String> memberIds = membersPage.getContent().stream().map(Member::getId).toList();

        Map<String, Membership> tempMembershipMap = new java.util.HashMap<>();
        if (!memberIds.isEmpty()) {
            List<String> currMemIds = membersPage.getContent().stream()
                    .map(Member::getCurrentMembershipId)
                    .filter(Objects::nonNull)
                    .toList();
            if (!currMemIds.isEmpty()) {
                List<Membership> currMems = membershipRepository.findByGymIdAndIdIn(gymId, currMemIds);
                for (Membership m : currMems) {
                    tempMembershipMap.put(m.getMemberId(), m);
                }
            }
            List<String> remainingMemberIds = memberIds.stream()
                    .filter(mid -> !tempMembershipMap.containsKey(mid))
                    .toList();
            if (!remainingMemberIds.isEmpty()) {
                Aggregation agg = Aggregation.newAggregation(
                        Aggregation.match(Criteria.where("gymId").is(gymId).and("memberId").in(remainingMemberIds)),
                        Aggregation.sort(Sort.Direction.DESC, "expiryDate"),
                        Aggregation.group("memberId").first(Aggregation.ROOT).as("latestMembership"),
                        Aggregation.replaceRoot("latestMembership")
                );
                List<Membership> memberships = mongoTemplate.aggregate(agg, "memberships", Membership.class).getMappedResults();
                for (Membership m : memberships) {
                    tempMembershipMap.put(m.getMemberId(), m);
                }
            }
        }

        final Map<String, Membership> membershipMap = tempMembershipMap;

        List<MemberResponse> content = membersPage.stream()
                .map(member -> mapToResponse(member, membershipMap.get(member.getId())))
                .toList();

        return PagedResponse.<MemberResponse>builder()
                .content(content)
                .page(membersPage.getNumber())
                .size(membersPage.getSize())
                .totalElements(membersPage.getTotalElements())
                .totalPages(membersPage.getTotalPages())
                .last(membersPage.isLast())
                .build();
    }

    public MemberResponse getMemberById(String id) {
        String gymId = TenantContext.getGymId();

        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            String trainerId = com.gymapp.security.SecurityUtils.getCurrentUserId();
            boolean isAssigned = trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                    gymId, trainerId, id, "ACTIVE");
            if (!isAssigned) {
                throw new AppException(ErrorCode.MEMBER_NOT_FOUND, "Member not found");
            }
        }

        Member member = memberRepository.findByIdAndGymId(id, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));

        Membership activeMembership = null;
        if (member.getCurrentMembershipId() != null) {
            activeMembership = membershipRepository.findByIdAndGymId(member.getCurrentMembershipId(), gymId).orElse(null);
        }
        if (activeMembership == null) {
            activeMembership = membershipRepository.findTopByMemberIdAndGymIdOrderByExpiryDateDesc(id, gymId).orElse(null);
        }

        return mapToResponse(member, activeMembership);
    }

    @Transactional
    public MemberResponse updateMember(String id, com.gymapp.module.member.dto.UpdateMemberRequest request) {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot update members");
        }

        String gymId = TenantContext.getGymId();
        Member member = memberRepository.findByIdAndGymId(id, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));

        if (!member.getPhone().equals(request.getPhone())) {
            if (memberRepository.existsByGymIdAndPhone(gymId, request.getPhone())) {
                throw new AppException(ErrorCode.MEMBER_PHONE_EXISTS, "Phone number already exists in this gym");
            }
        }

        member.setName(request.getName());
        member.setPhone(request.getPhone());
        member.setGender(request.getGender());
        member.setDob(request.getDob());
        member.setAddress(request.getAddress());
        member = memberRepository.save(member);

        Membership activeMembership = membershipRepository.findTopByMemberIdAndGymIdOrderByExpiryDateDesc(id, gymId)
                .orElse(null);

        return mapToResponse(member, activeMembership);
    }

    @Transactional
    public void deleteMember(String id) {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot delete members");
        }

        String gymId = TenantContext.getGymId();
        Member member = memberRepository.findByIdAndGymId(id, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));

        member.setStatus("INACTIVE");
        memberRepository.save(member);

        List<Membership> activeMemberships = membershipRepository.findByGymIdAndMemberId(gymId, id);
        for (Membership m : activeMemberships) {
            if (m.getStatus() == Membership.MembershipStatus.ACTIVE) {
                m.setStatus(Membership.MembershipStatus.EXPIRED);
            }
        }
        membershipRepository.saveAll(activeMemberships);

        // Deleting or inactivating a member automatically ends their active trainer assignments
        String callerUserId = com.gymapp.security.SecurityUtils.getCurrentUserId();
        trainerAssignmentService.endAllActiveAssignmentsForMember(gymId, id, callerUserId);

        if (dashboardService != null) {
            dashboardService.evictCache(gymId);
        }
        if (paymentService != null) {
            paymentService.evictSummaryCache(gymId);
        }
    }

    @Transactional
    public MembershipResponse renewMembership(String id, RenewMembershipRequest request) {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot renew memberships");
        }

        String gymId = TenantContext.getGymId();
        Member member = memberRepository.findByIdAndGymId(id, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));

        if (!"ACTIVE".equals(member.getStatus())) {
            throw new AppException(ErrorCode.MEMBER_INACTIVE, "Cannot renew a deleted member");
        }

        Plan plan = planRepository.findByIdAndGymId(request.getPlanId(), gymId)
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_FOUND));

        Membership lastMembership = membershipRepository.findTopByMemberIdAndGymIdOrderByExpiryDateDesc(id, gymId)
                .orElse(null);

        LocalDate startDate = request.getStartDate();
        LocalDate today = LocalDate.now(clock);
        if (startDate == null) {
            if (lastMembership != null && lastMembership.getExpiryDate().isAfter(today.minusDays(1))) {
                startDate = lastMembership.getExpiryDate().plusDays(1);
            } else {
                startDate = today;
            }
        }

        LocalDate expiryDate = startDate.plusDays(plan.getDurationDays());

        long initialPaid = request.getPaidAmount() != null ? request.getPaidAmount() : 0L;
        if (initialPaid < 0) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Paid amount cannot be negative");
        }
        if (initialPaid > plan.getPricePaise()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Paid amount cannot exceed plan price");
        }
        long initialDue = plan.getPricePaise() - initialPaid;

        Membership.MembershipStatus initialStatus = startDate.isAfter(today)
                ? Membership.MembershipStatus.UPCOMING
                : Membership.MembershipStatus.ACTIVE;

        Membership newMembership = Membership.builder()
                .gymId(gymId)
                .memberId(id)
                .planId(plan.getId())
                .planName(plan.getName())
                .totalPaise(plan.getPricePaise())
                .paidPaise(initialPaid)
                .duePaise(initialDue)
                .startDate(startDate)
                .expiryDate(expiryDate)
                .status(initialStatus)
                .build();

        newMembership = membershipRepository.save(newMembership);

        if (initialPaid > 0) {
            String receiptNo = sequenceService.generateNextReceiptNo(gymId);
            String currentUserId = com.gymapp.security.SecurityUtils.getCurrentUserId();
            com.gymapp.module.payment.entity.Payment renewalPayment = com.gymapp.module.payment.entity.Payment.builder()
                    .gymId(gymId)
                    .memberId(member.getId())
                    .membershipId(newMembership.getId())
                    .amountPaise(initialPaid)
                    .mode(StringUtils.hasText(request.getPaymentMode()) ? request.getPaymentMode() : "CASH")
                    .paidAt(java.time.LocalDateTime.now(clock))
                    .receivedAt(java.time.LocalDateTime.now(clock))
                    .receiptNo(receiptNo)
                    .type("PAYMENT")
                    .receivedBy(currentUserId)
                    .reason("Membership renewal payment")
                    .build();
            mongoTemplate.save(renewalPayment);
        }

        membershipLedgerService.recalculate(gymId, member.getId());
        newMembership = membershipRepository.findByIdAndGymId(newMembership.getId(), gymId).orElse(newMembership);

        return mapToMembershipResponse(newMembership);
    }

    private MemberResponse mapToResponse(Member member, Membership membership) {
        String phone = member.getPhone();
        LocalDate dob = member.getDob();
        String address = member.getAddress();
        long currentDuePaise = member.getCurrentDuePaise();

        boolean isOwner = com.gymapp.security.SecurityUtils.isOwner();
        boolean isStaff = com.gymapp.security.SecurityUtils.isStaff();
        boolean isTrainer = com.gymapp.security.SecurityUtils.isTrainer();

        if (!isOwner) {
            // Address and dob are omitted entirely for STAFF and TRAINER
            address = null;
            dob = null;

            boolean staffCanSeeFull = false;
            if (isStaff) {
                com.gymapp.module.auth.entity.Gym gym = mongoTemplate.findById(
                        member.getGymId(), com.gymapp.module.auth.entity.Gym.class);
                if (gym != null && gym.isStaffCanSeeFullPhone()) {
                    staffCanSeeFull = true;
                }
            }

            if (!staffCanSeeFull) {
                phone = com.gymapp.common.PhoneMasker.mask(phone);
            }
        }

        if (isTrainer) {
            currentDuePaise = 0L;
        }

        return MemberResponse.builder()
                .id(member.getId())
                .gymId(member.getGymId())
                .memberCode(member.getMemberCode())
                .name(member.getName())
                .phone(phone)
                .gender(member.getGender())
                .dob(dob)
                .address(address)
                .photoUrl(member.getPhotoPath() != null ? "/api/members/" + member.getId() + "/photo" : null)
                .status(member.getStatus())
                .currentExpiry(member.getCurrentExpiry())
                .currentDuePaise(currentDuePaise)
                .dueTotalPaise(currentDuePaise)
                .currentMembershipId(member.getCurrentMembershipId())
                .lastAttendanceDate(member.getLastAttendanceDate())
                .createdAt(member.getCreatedAt())
                .updatedAt(member.getUpdatedAt())
                .currentMembership(membership != null ? mapToMembershipResponse(membership) : null)
                .build();
    }

    private MemberResponse mapToResponseBasic(Member member) {
        return mapToResponse(member, null);
    }

    @Transactional
    public MembershipResponse applyDiscount(String membershipId, ApplyDiscountRequest request) {
        if (!com.gymapp.security.SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Only owners can apply discounts");
        }

        String gymId = TenantContext.getGymId();
        Membership membership = membershipRepository.findByIdAndGymId(membershipId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Membership not found"));

        if (request.getDiscountPaise() == null || request.getDiscountPaise() <= 0) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Discount amount must be positive");
        }

        long currentDue = membership.getTotalPaise() - membership.getDiscountPaise() - membership.getPaidPaise();
        if (request.getDiscountPaise() > currentDue) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Discount cannot be more than the current due");
        }

        long newTotalDiscount = membership.getDiscountPaise() + request.getDiscountPaise();
        membership.setDiscountPaise(newTotalDiscount);
        membership.setDiscountReason(request.getReason() != null ? request.getReason().trim() : null);
        membership = membershipRepository.save(membership);

        membershipLedgerService.recalculate(gymId, membership.getMemberId());
        membership = membershipRepository.findByIdAndGymId(membership.getId(), gymId).orElse(membership);

        // Audit entry: DISCOUNT_APPLIED (amount only, no personal data)
        auditLogService.log("DISCOUNT_APPLIED", membership.getId(), "{\"amountPaise\":" + request.getDiscountPaise() + "}");

        return mapToMembershipResponse(membership);
    }

    @Transactional
    public MembershipResponse updatePromisedDate(String membershipId, UpdatePromisedDateRequest request) {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot update promised date");
        }

        String gymId = TenantContext.getGymId();
        Membership membership = membershipRepository.findByIdAndGymId(membershipId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND, "Membership not found"));

        if (request.getPromisedDate() == null) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Promised date is required");
        }

        LocalDate today = LocalDate.now(clock);
        LocalDate promisedDate = request.getPromisedDate();

        if (!promisedDate.isAfter(today)) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Promised date must be in the future");
        }

        if (promisedDate.isAfter(today.plusDays(90))) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Promised date cannot be later than 90 days");
        }

        membership.setPromisedDate(promisedDate);
        membership = membershipRepository.save(membership);

        return mapToMembershipResponse(membership);
    }

    public com.gymapp.module.member.dto.MemberFeesResponse getMemberFees(String memberId) {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot view fee details");
        }
        String gymId = TenantContext.getGymId();
        Member member = memberRepository.findByIdAndGymId(memberId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));

        List<Membership> memberships = membershipRepository.findByGymIdAndMemberId(gymId, memberId);
        memberships.sort(Comparator.comparing(Membership::getStartDate, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(Membership::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())));

        List<com.gymapp.module.member.dto.MemberFeesResponse.MembershipFeeItem> items = memberships.stream()
                .map(m -> com.gymapp.module.member.dto.MemberFeesResponse.MembershipFeeItem.builder()
                        .id(m.getId())
                        .planName(m.getPlanName())
                        .startDate(m.getStartDate())
                        .expiryDate(m.getExpiryDate())
                        .status(m.getStatus() != null ? m.getStatus().name() : "ACTIVE")
                        .totalPaise(m.getTotalPaise())
                        .discountPaise(m.getDiscountPaise())
                        .paidPaise(m.getPaidPaise())
                        .duePaise(m.getDuePaise())
                        .build())
                .toList();

        long dueTotalPaise = memberships.stream().mapToLong(Membership::getDuePaise).sum();

        String defaultMembershipId = memberships.stream()
                .filter(m -> m.getDuePaise() > 0)
                .map(Membership::getId)
                .findFirst()
                .orElse(null);

        return com.gymapp.module.member.dto.MemberFeesResponse.builder()
                .memberships(items)
                .dueTotalPaise(dueTotalPaise)
                .defaultMembershipId(defaultMembershipId)
                .build();
    }

    private MembershipResponse mapToMembershipResponse(Membership membership) {
        long totalPaise = membership.getTotalPaise();
        long discountPaise = membership.getDiscountPaise();
        long paidPaise = membership.getPaidPaise();
        long duePaise = membership.getDuePaise();

        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            totalPaise = 0L;
            discountPaise = 0L;
            paidPaise = 0L;
            duePaise = 0L;
        }

        return MembershipResponse.builder()
                .id(membership.getId())
                .gymId(membership.getGymId())
                .memberId(membership.getMemberId())
                .planId(membership.getPlanId())
                .planName(membership.getPlanName())
                .totalPaise(totalPaise)
                .discountPaise(discountPaise)
                .discountReason(membership.getDiscountReason())
                .promisedDate(membership.getPromisedDate())
                .paidPaise(paidPaise)
                .duePaise(duePaise)
                .startDate(membership.getStartDate())
                .expiryDate(membership.getExpiryDate())
                .status(membership.getStatus().name())
                .createdAt(membership.getCreatedAt())
                .build();
    }
}
