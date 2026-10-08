package com.gymapp.module.attendance.service;

import com.gymapp.common.PagedResponse;
import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.attendance.dto.AbsentMemberResponse;
import com.gymapp.module.attendance.dto.AttendanceRecordResponse;
import com.gymapp.module.attendance.dto.CheckInRequest;
import com.gymapp.module.attendance.dto.CheckInResponse;
import com.gymapp.module.attendance.entity.Attendance;
import com.gymapp.module.attendance.repository.AttendanceRepository;
import com.gymapp.module.member.entity.Member;
import com.gymapp.module.member.entity.Membership;
import com.gymapp.module.member.repository.MemberRepository;
import com.gymapp.module.member.repository.MembershipRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final MemberRepository memberRepository;
    private final MembershipRepository membershipRepository;
    private final MongoTemplate mongoTemplate;
    private final com.gymapp.module.trainer.repository.TrainerAssignmentRepository trainerAssignmentRepository;

    public CheckInResponse checkIn(CheckInRequest request) {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot perform check-ins");
        }

        String gymId = TenantContext.getGymId();

        Member member;
        if (StringUtils.hasText(request.getMemberId())) {
            member = memberRepository.findByIdAndGymId(request.getMemberId(), gymId)
                    .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND));
        } else if (StringUtils.hasText(request.getMemberCode())) {
            member = memberRepository.findByGymIdAndMemberCode(gymId, request.getMemberCode())
                    .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND, "Member code not found"));
        } else {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Either memberId or memberCode must be provided");
        }

        if (!"ACTIVE".equals(member.getStatus())) {
            throw new AppException(ErrorCode.MEMBER_INACTIVE);
        }

        LocalDate today = LocalDate.now();

        if (attendanceRepository.existsByGymIdAndMemberIdAndDate(gymId, member.getId(), today)) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Member has already checked in today");
        }

        // Check if there is an active membership
        boolean isMembershipActive = membershipRepository.findTopByMemberIdAndGymIdOrderByExpiryDateDesc(member.getId(), gymId)
                .map(m -> m.getStatus() == Membership.MembershipStatus.ACTIVE && !m.getExpiryDate().isBefore(today))
                .orElse(false);

        if (!isMembershipActive) {
            com.gymapp.module.auth.entity.Gym gym = mongoTemplate.findById(gymId, com.gymapp.module.auth.entity.Gym.class);
            if (gym != null && !gym.isAllowExpiredCheckin()) {
                throw new AppException(ErrorCode.VALIDATION_ERROR, "Membership expired and gym does not allow expired check-ins");
            }
        }

        Attendance attendance = Attendance.builder()
                .gymId(gymId)
                .memberId(member.getId())
                .date(today)
                .checkInTime(LocalTime.now())
                .expiredWarning(!isMembershipActive)
                .build();

        try {
            attendance = attendanceRepository.save(attendance);
        } catch (DuplicateKeyException e) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Member has already checked in today");
        }

        member.setLastAttendanceDate(today);
        mongoTemplate.updateFirst(
                new org.springframework.data.mongodb.core.query.Query(Criteria.where("_id").is(member.getId())),
                new org.springframework.data.mongodb.core.query.Update().set("lastAttendanceDate", today),
                Member.class
        );

        return CheckInResponse.builder()
                .id(attendance.getId())
                .memberId(member.getId())
                .memberName(member.getName())
                .date(attendance.getDate())
                .checkInTime(attendance.getCheckInTime())
                .membershipExpiredWarning(!isMembershipActive)
                .build();
    }

    public PagedResponse<AttendanceRecordResponse> getAttendanceByDate(LocalDate date, Pageable pageable) {
        String gymId = TenantContext.getGymId();
        Page<Attendance> page;

        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            String trainerId = com.gymapp.security.SecurityUtils.getCurrentUserId();
            List<com.gymapp.module.trainer.entity.TrainerAssignment> assignments =
                    trainerAssignmentRepository.findByGymIdAndTrainerIdAndStatus(gymId, trainerId, "ACTIVE");
            List<String> assignedMemberIds = assignments.stream()
                    .map(com.gymapp.module.trainer.entity.TrainerAssignment::getMemberId)
                    .toList();

            if (assignedMemberIds.isEmpty()) {
                return PagedResponse.<AttendanceRecordResponse>builder()
                        .content(List.of())
                        .page(pageable.getPageNumber())
                        .size(pageable.getPageSize())
                        .totalElements(0)
                        .totalPages(0)
                        .last(true)
                        .build();
            }

            org.springframework.data.mongodb.core.query.Query query =
                    new org.springframework.data.mongodb.core.query.Query().with(pageable);
            query.addCriteria(Criteria.where("gymId").is(gymId)
                    .and("date").is(date)
                    .and("memberId").in(assignedMemberIds));

            long total = mongoTemplate.count(
                    org.springframework.data.mongodb.core.query.Query.of(query).limit(-1).skip(-1), Attendance.class);
            List<Attendance> attendances = mongoTemplate.find(query, Attendance.class);
            page = new org.springframework.data.domain.PageImpl<>(attendances, pageable, total);
        } else {
            page = attendanceRepository.findByGymIdAndDate(gymId, date, pageable);
        }

        List<String> memberIds = page.getContent().stream()
                .map(Attendance::getMemberId)
                .distinct()
                .toList();

        Map<String, Member> memberMap = memberRepository.findByGymIdAndIdIn(gymId, memberIds).stream()
                .collect(Collectors.toMap(Member::getId, m -> m));

        List<AttendanceRecordResponse> content = page.getContent().stream()
                .map(a -> {
                    Member m = memberMap.get(a.getMemberId());
                    return AttendanceRecordResponse.builder()
                            .id(a.getId())
                            .memberId(a.getMemberId())
                            .memberName(m != null ? m.getName() : "Unknown")
                            .memberCode(m != null ? m.getMemberCode() : "")
                            .date(a.getDate())
                            .checkInTime(a.getCheckInTime())
                            .build();
                })
                .toList();

        return PagedResponse.<AttendanceRecordResponse>builder()
                .content(content)
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }

    public PagedResponse<AbsentMemberResponse> getAbsentMembers(int days, Pageable pageable) {
        String gymId = TenantContext.getGymId();
        LocalDate thresholdDate = LocalDate.now().minusDays(days);
        LocalDate today = LocalDate.now();

        Criteria baseCriteria = Criteria.where("gymId").is(gymId).and("status").is("ACTIVE");
        Criteria absentCriteria = new Criteria().orOperator(
                Criteria.where("lastAttendanceDate").is(null),
                Criteria.where("lastAttendanceDate").lt(thresholdDate)
        );

        List<Criteria> criteriaList = new java.util.ArrayList<>();
        criteriaList.add(baseCriteria);
        criteriaList.add(absentCriteria);

        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            String trainerId = com.gymapp.security.SecurityUtils.getCurrentUserId();
            List<com.gymapp.module.trainer.entity.TrainerAssignment> assignments =
                    trainerAssignmentRepository.findByGymIdAndTrainerIdAndStatus(gymId, trainerId, "ACTIVE");
            List<String> assignedMemberIds = assignments.stream()
                    .map(com.gymapp.module.trainer.entity.TrainerAssignment::getMemberId)
                    .toList();

            if (assignedMemberIds.isEmpty()) {
                return PagedResponse.<AbsentMemberResponse>builder()
                        .content(List.of())
                        .page(pageable.getPageNumber())
                        .size(pageable.getPageSize())
                        .totalElements(0)
                        .totalPages(0)
                        .last(true)
                        .build();
            }
            criteriaList.add(Criteria.where("id").in(assignedMemberIds));
        }

        Criteria finalCriteria = new Criteria().andOperator(criteriaList.toArray(new Criteria[0]));
        org.springframework.data.mongodb.core.query.Query query = new org.springframework.data.mongodb.core.query.Query(finalCriteria);
        long totalElements = mongoTemplate.count(query, Member.class);

        if (totalElements == 0) {
            return PagedResponse.<AbsentMemberResponse>builder()
                    .content(List.of())
                    .page(pageable.getPageNumber())
                    .size(pageable.getPageSize())
                    .totalElements(0)
                    .totalPages(0)
                    .last(true)
                    .build();
        }

        query.with(pageable);
        List<Member> absentMembers = mongoTemplate.find(query, Member.class);

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

        List<AbsentMemberResponse> content = absentMembers.stream().map(m -> {
            LocalDate lastDate = m.getLastAttendanceDate();
            long daysAbsent = lastDate != null ? ChronoUnit.DAYS.between(lastDate, today) : 
                              (m.getCreatedAt() != null ? ChronoUnit.DAYS.between(m.getCreatedAt().toLocalDate(), today) : days);
            String phone = canSeePhone ? m.getPhone() : com.gymapp.common.PhoneMasker.mask(m.getPhone());

            return AbsentMemberResponse.builder()
                    .memberId(m.getId())
                    .memberCode(m.getMemberCode())
                    .memberName(m.getName())
                    .phone(phone)
                    .lastAttendanceDate(lastDate)
                    .daysAbsent(daysAbsent)
                    .build();
        }).toList();

        int totalPages = (int) Math.ceil((double) totalElements / pageable.getPageSize());

        return PagedResponse.<AbsentMemberResponse>builder()
                .content(content)
                .page(pageable.getPageNumber())
                .size(pageable.getPageSize())
                .totalElements(totalElements)
                .totalPages(totalPages)
                .last(pageable.getPageNumber() >= totalPages - 1)
                .build();
    }

    public PagedResponse<AttendanceRecordResponse> getMemberAttendanceHistory(String memberId, Pageable pageable) {
        String gymId = TenantContext.getGymId();

        Member member = memberRepository.findByIdAndGymId(memberId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.MEMBER_NOT_FOUND, "Member not found"));

        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            String trainerId = com.gymapp.security.SecurityUtils.getCurrentUserId();
            boolean isAssigned = trainerAssignmentRepository.existsByGymIdAndTrainerIdAndMemberIdAndStatus(
                    gymId, trainerId, memberId, "ACTIVE");
            if (!isAssigned) {
                throw new AppException(ErrorCode.MEMBER_NOT_FOUND, "Member not found");
            }
        }

        Page<Attendance> page = attendanceRepository.findByGymIdAndMemberId(gymId, memberId, pageable);

        List<AttendanceRecordResponse> content = page.getContent().stream()
                .map(a -> AttendanceRecordResponse.builder()
                        .id(a.getId())
                        .memberId(a.getMemberId())
                        .memberName(member != null ? member.getName() : "Unknown")
                        .memberCode(member != null ? member.getMemberCode() : "")
                        .date(a.getDate())
                        .checkInTime(a.getCheckInTime())
                        .build())
                .toList();

        return PagedResponse.<AttendanceRecordResponse>builder()
                .content(content)
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}
