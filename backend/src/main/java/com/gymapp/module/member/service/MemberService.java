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

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
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

        Member member = Member.builder()
                .gymId(gymId)
                .memberCode(memberCode)
                .name(request.getName())
                .phone(request.getPhone())
                .gender(request.getGender())
                .dob(request.getDob())
                .address(request.getAddress())
                .status("ACTIVE")
                .build();
        member = memberRepository.save(member);

        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : LocalDate.now();
        LocalDate expiryDate = startDate.plusDays(plan.getDurationDays());

        Membership membership = Membership.builder()
                .gymId(gymId)
                .memberId(member.getId())
                .planId(plan.getId())
                .planName(plan.getName())
                .totalPaise(plan.getPricePaise())
                .paidPaise(0L)
                .duePaise(plan.getPricePaise())
                .startDate(startDate)
                .expiryDate(expiryDate)
                .status(Membership.MembershipStatus.ACTIVE)
                .build();
        membership = membershipRepository.save(membership);

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
                    query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("status").is("ACTIVE"));
                }
            } else if ("Expired".equalsIgnoreCase(status)) {
                query.addCriteria(org.springframework.data.mongodb.core.query.Criteria.where("currentExpiry").lt(LocalDate.now()));
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

        Map<String, Membership> tempMembershipMap = Map.of();
        if (!memberIds.isEmpty()) {
            Aggregation agg = Aggregation.newAggregation(
                    Aggregation.match(Criteria.where("gymId").is(gymId).and("memberId").in(memberIds)),
                    Aggregation.sort(Sort.Direction.DESC, "expiryDate"),
                    Aggregation.group("memberId").first(Aggregation.ROOT).as("latestMembership"),
                    Aggregation.replaceRoot("latestMembership")
            );
            List<Membership> memberships = mongoTemplate.aggregate(agg, "memberships", Membership.class).getMappedResults();
            tempMembershipMap = memberships.stream().collect(Collectors.toMap(Membership::getMemberId, m -> m));
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

        Membership activeMembership = membershipRepository.findTopByMemberIdAndGymIdOrderByExpiryDateDesc(id, gymId)
                .orElse(null);

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
        if (startDate == null) {
            LocalDate today = LocalDate.now();
            if (lastMembership != null && lastMembership.getExpiryDate().isAfter(today.minusDays(1))) {
                startDate = lastMembership.getExpiryDate().plusDays(1);
            } else {
                startDate = today;
            }
        }

        LocalDate expiryDate = startDate.plusDays(plan.getDurationDays());

        Membership newMembership = Membership.builder()
                .gymId(gymId)
                .memberId(id)
                .planId(plan.getId())
                .planName(plan.getName())
                .totalPaise(plan.getPricePaise())
                .paidPaise(0L)
                .duePaise(plan.getPricePaise())
                .startDate(startDate)
                .expiryDate(expiryDate)
                .status(Membership.MembershipStatus.ACTIVE)
                .build();

        newMembership = membershipRepository.save(newMembership);

        // Optional: expire older active memberships if they are logically replaced
        if (lastMembership != null && lastMembership.getStatus() == Membership.MembershipStatus.ACTIVE) {
             if (LocalDate.now().isAfter(lastMembership.getExpiryDate())) {
                 lastMembership.setStatus(Membership.MembershipStatus.EXPIRED);
                 membershipRepository.save(lastMembership);
             }
        }

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
                .lastAttendanceDate(member.getLastAttendanceDate())
                .createdAt(member.getCreatedAt())
                .updatedAt(member.getUpdatedAt())
                .currentMembership(membership != null ? mapToMembershipResponse(membership) : null)
                .build();
    }

    private MemberResponse mapToResponseBasic(Member member) {
        return mapToResponse(member, null);
    }

    private MembershipResponse mapToMembershipResponse(Membership membership) {
        long totalPaise = membership.getTotalPaise();
        long paidPaise = membership.getPaidPaise();
        long duePaise = membership.getDuePaise();

        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            totalPaise = 0L;
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
                .paidPaise(paidPaise)
                .duePaise(duePaise)
                .startDate(membership.getStartDate())
                .expiryDate(membership.getExpiryDate())
                .status(membership.getStatus().name())
                .createdAt(membership.getCreatedAt())
                .build();
    }
}
