package com.gymapp.module.trainer.service;

import com.gymapp.common.PagedResponse;
import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.audit.service.AuditLogService;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.trainer.dto.AssignMembersRequest;
import com.gymapp.module.trainer.dto.AssignmentResponse;
import com.gymapp.module.trainer.dto.ReassignTrainerRequest;
import com.gymapp.module.trainer.entity.TrainerAssignment;
import com.gymapp.module.trainer.repository.TrainerAssignmentRepository;
import com.gymapp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TrainerAssignmentService {

    private final TrainerAssignmentRepository trainerAssignmentRepository;
    private final UserRepository userRepository;
    private final MemberRepository memberRepository;
    private final AuditLogService auditLogService;
    private final MongoTemplate mongoTemplate;

    @Transactional
    public List<AssignmentResponse> assignMembers(AssignMembersRequest request) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        String callerUserId = SecurityUtils.getCurrentUserId();

        User trainer = userRepository.findByIdAndGymId(request.getTrainerId(), gymId)
                .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                .orElseThrow(() -> new AppException(ErrorCode.TRAINER_NOT_FOUND));

        if (!trainer.isActive() || !"ACTIVE".equalsIgnoreCase(trainer.getStatus())) {
            throw new AppException(ErrorCode.TRAINER_INACTIVE, "Trainer is not active");
        }

        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : LocalDate.now();
        List<TrainerAssignment> created = new ArrayList<>();

        for (String memberId : request.getMemberIds()) {
            Member member = memberRepository.findByIdAndGymId(memberId, gymId)
                    .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND, "Member not found"));

            if (!"ACTIVE".equalsIgnoreCase(member.getStatus())) {
                throw new AppException(ErrorCode.MEMBER_INACTIVE, "Member is inactive");
            }

            if (trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                    gymId, trainer.getId(), member.getId(), "ACTIVE")) {
                throw new AppException(ErrorCode.ASSIGNMENT_EXISTS,
                        "Member already has an active assignment with this trainer");
            }

            TrainerAssignment assignment = TrainerAssignment.builder()
                    .gymId(gymId)
                    .trainerId(trainer.getId())
                    .memberId(member.getId())
                    .status("ACTIVE")
                    .startDate(startDate)
                    .assignedBy(callerUserId)
                    .ptFeePaise(request.getPtFeePaise())
                    .sessionsTotal(request.getSessionsTotal())
                    .notes(request.getNotes())
                    .build();

            try {
                assignment = trainerAssignmentRepository.save(assignment);
                created.add(assignment);
            } catch (org.springframework.dao.DuplicateKeyException e) {
                throw new AppException(ErrorCode.ASSIGNMENT_EXISTS,
                        "Member already has an active assignment with this trainer");
            }

            auditLogService.log("ASSIGN_MEMBER", assignment.getId(),
                    "Assigned member " + member.getName() + " to trainer " + trainer.getName());
        }

        return created.stream().map(a -> mapToResponse(a, trainer.getName(), null, null, null)).toList();
    }

    @Transactional
    public AssignmentResponse endAssignment(String assignmentId) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        String callerUserId = SecurityUtils.getCurrentUserId();

        TrainerAssignment assignment = trainerAssignmentRepository.findByIdAndGymId(assignmentId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.ASSIGNMENT_NOT_FOUND));

        if ("ACTIVE".equalsIgnoreCase(assignment.getStatus())) {
            assignment.setStatus("ENDED");
            assignment.setEndDate(LocalDate.now());
            assignment.setEndedBy(callerUserId);
            assignment = trainerAssignmentRepository.save(assignment);

            auditLogService.log("END_ASSIGNMENT", assignment.getId(),
                    "Ended assignment for member " + assignment.getMemberId() + " with trainer " + assignment.getTrainerId());
        }

        User trainer = userRepository.findByIdAndGymId(assignment.getTrainerId(), gymId).orElse(null);
        Member member = memberRepository.findByIdAndGymId(assignment.getMemberId(), gymId).orElse(null);

        return mapToResponse(
                assignment,
                trainer != null ? trainer.getName() : null,
                member != null ? member.getName() : null,
                member != null ? member.getMemberCode() : null,
                member != null ? member.getPhone() : null
        );
    }

    @Transactional
    public void reassignAll(ReassignTrainerRequest request) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        String callerUserId = SecurityUtils.getCurrentUserId();

        if (request.getFromTrainerId().equals(request.getToTrainerId())) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Cannot reassign to the same trainer");
        }

        User fromTrainer = userRepository.findByIdAndGymId(request.getFromTrainerId(), gymId)
                .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                .orElseThrow(() -> new AppException(ErrorCode.TRAINER_NOT_FOUND, "Source trainer not found"));

        User toTrainer = userRepository.findByIdAndGymId(request.getToTrainerId(), gymId)
                .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                .orElseThrow(() -> new AppException(ErrorCode.TRAINER_NOT_FOUND, "Target trainer not found"));

        if (!toTrainer.isActive() || !"ACTIVE".equalsIgnoreCase(toTrainer.getStatus())) {
            throw new AppException(ErrorCode.TRAINER_INACTIVE, "Target trainer is not active");
        }

        List<TrainerAssignment> activeAssignments = trainerAssignmentRepository.findByGymIdAndTrainerIdAndStatus(
                gymId, fromTrainer.getId(), "ACTIVE");

        LocalDate today = LocalDate.now();

        for (TrainerAssignment oldAssignment : activeAssignments) {
            oldAssignment.setStatus("ENDED");
            oldAssignment.setEndDate(today);
            oldAssignment.setEndedBy(callerUserId);
            trainerAssignmentRepository.save(oldAssignment);

            // Create new assignment to target trainer if not already active
            if (!trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                    gymId, toTrainer.getId(), oldAssignment.getMemberId(), "ACTIVE")) {
                TrainerAssignment newAssignment = TrainerAssignment.builder()
                        .gymId(gymId)
                        .trainerId(toTrainer.getId())
                        .memberId(oldAssignment.getMemberId())
                        .status("ACTIVE")
                        .startDate(today)
                        .assignedBy(callerUserId)
                        .ptFeePaise(oldAssignment.getPtFeePaise())
                        .sessionsTotal(oldAssignment.getSessionsTotal())
                        .notes(StringUtils.hasText(request.getNotes()) ? request.getNotes() : oldAssignment.getNotes())
                        .build();
                trainerAssignmentRepository.save(newAssignment);
            }
        }

        auditLogService.log("REASSIGN_TRAINER", toTrainer.getId(),
                "Reassigned " + activeAssignments.size() + " members from " + fromTrainer.getName() + " to " + toTrainer.getName());
    }

    @Transactional
    public void endAllActiveAssignmentsForTrainer(String gymId, String trainerId, String endedBy) {
        List<TrainerAssignment> activeAssignments = trainerAssignmentRepository.findByGymIdAndTrainerIdAndStatus(
                gymId, trainerId, "ACTIVE");

        LocalDate today = LocalDate.now();
        for (TrainerAssignment a : activeAssignments) {
            a.setStatus("ENDED");
            a.setEndDate(today);
            a.setEndedBy(endedBy);
        }
        trainerAssignmentRepository.saveAll(activeAssignments);

        if (!activeAssignments.isEmpty()) {
            auditLogService.log(gymId, endedBy, "OWNER", "AUTO_END_ASSIGNMENTS", trainerId,
                    "Auto-ended " + activeAssignments.size() + " assignments for trainer " + trainerId);
        }
    }

    @Transactional
    public void endAllActiveAssignmentsForMember(String gymId, String memberId, String endedBy) {
        List<TrainerAssignment> activeAssignments = trainerAssignmentRepository.findByGymIdAndMemberIdAndStatus(
                gymId, memberId, "ACTIVE");

        LocalDate today = LocalDate.now();
        for (TrainerAssignment a : activeAssignments) {
            a.setStatus("ENDED");
            a.setEndDate(today);
            a.setEndedBy(endedBy);
        }
        trainerAssignmentRepository.saveAll(activeAssignments);

        if (!activeAssignments.isEmpty()) {
            auditLogService.log(gymId, endedBy, "OWNER", "AUTO_END_ASSIGNMENTS", memberId,
                    "Auto-ended " + activeAssignments.size() + " assignments for member " + memberId);
        }
    }

    public PagedResponse<AssignmentResponse> getAssignments(
            String trainerId, String memberId, String status, Pageable pageable) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();

        Query query = new Query().with(pageable);
        query.addCriteria(Criteria.where("gymId").is(gymId));

        if (StringUtils.hasText(trainerId)) {
            query.addCriteria(Criteria.where("trainerId").is(trainerId));
        }
        if (StringUtils.hasText(memberId)) {
            query.addCriteria(Criteria.where("memberId").is(memberId));
        }
        if (StringUtils.hasText(status) && !"ALL".equalsIgnoreCase(status)) {
            query.addCriteria(Criteria.where("status").is(status.toUpperCase()));
        }

        long total = mongoTemplate.count(Query.of(query).limit(-1).skip(-1), TrainerAssignment.class);
        List<TrainerAssignment> list = mongoTemplate.find(query, TrainerAssignment.class);

        // Fetch trainer & member info in bulk
        List<String> trainerIds = list.stream().map(TrainerAssignment::getTrainerId).distinct().toList();
        List<String> memberIds = list.stream().map(TrainerAssignment::getMemberId).distinct().toList();

        Map<String, User> trainerMap = userRepository.findByGymIdAndIdIn(gymId, trainerIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        Map<String, Member> memberMap = memberRepository.findByGymIdAndIdIn(gymId, memberIds).stream()
                .collect(Collectors.toMap(Member::getId, m -> m));

        List<AssignmentResponse> content = list.stream().map(a -> {
            User t = trainerMap.get(a.getTrainerId());
            Member m = memberMap.get(a.getMemberId());
            return mapToResponse(
                    a,
                    t != null ? t.getName() : null,
                    m != null ? m.getName() : null,
                    m != null ? m.getMemberCode() : null,
                    m != null ? m.getPhone() : null
            );
        }).toList();

        Page<AssignmentResponse> page = new PageImpl<>(content, pageable, total);

        return PagedResponse.<AssignmentResponse>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }

    private AssignmentResponse mapToResponse(
            TrainerAssignment a, String trainerName, String memberName, String memberCode, String memberPhone) {
        return AssignmentResponse.builder()
                .id(a.getId())
                .gymId(a.getGymId())
                .trainerId(a.getTrainerId())
                .trainerName(trainerName)
                .memberId(a.getMemberId())
                .memberName(memberName)
                .memberCode(memberCode)
                .memberPhone(memberPhone)
                .status(a.getStatus())
                .startDate(a.getStartDate())
                .endDate(a.getEndDate())
                .assignedBy(a.getAssignedBy())
                .endedBy(a.getEndedBy())
                .ptFeePaise(a.getPtFeePaise())
                .sessionsTotal(a.getSessionsTotal())
                .notes(a.getNotes())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
