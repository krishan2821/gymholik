package com.gymapp.module.trainer.service;

import com.gymapp.common.PhoneMasker;
import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.audit.service.AuditLogService;
import com.gymapp.module.auth.dto.SendOtpRequest;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.RefreshTokenRepository;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.trainer.dto.*;
import com.gymapp.module.trainer.entity.TrainerType;
import com.gymapp.module.trainer.repository.TrainerAssignmentRepository;
import com.gymapp.module.trainer.repository.TrainerTypeRepository;
import com.gymapp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TrainerService {

    private static final Pattern INDIAN_PHONE_PATTERN = Pattern.compile("^[6-9]\\d{9}$");

    private final UserRepository userRepository;
    private final TrainerTypeRepository trainerTypeRepository;
    private final TrainerAssignmentRepository trainerAssignmentRepository;
    private final TrainerAssignmentService trainerAssignmentService;
    private final AuditLogService auditLogService;
    private final RefreshTokenRepository refreshTokenRepository;

    @Autowired(required = false)
    private com.gymapp.module.auth.repository.GymRepository gymRepository;

    @Autowired(required = false)
    private com.gymapp.module.auth.service.OtpService otpService;

    @Transactional
    public TrainerResponse createTrainer(CreateTrainerRequest request) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        String phone = normalizeAndValidatePhone(request.getPhone());

        // Phone uniqueness across the entire system — neutral error message (do not reveal which gym)
        if (userRepository.existsByPhone(phone)
                || (gymRepository != null && gymRepository.existsByPhone(phone))) {
            throw new AppException(ErrorCode.PHONE_ALREADY_REGISTERED, "This phone number is already registered");
        }

        List<String> distinctTypeIds = request.getTrainerTypeIds() != null
                ? request.getTrainerTypeIds().stream().distinct().toList()
                : List.of();
        validateTrainerTypeIds(gymId, distinctTypeIds);

        User trainer = User.builder()
                .gymId(gymId)
                .name(request.getName().trim())
                .phone(phone)
                .role("TRAINER")
                .active(true)
                .status("ACTIVE")
                .trainerTypeIds(new ArrayList<>(distinctTypeIds))
                .tokenVersion(0)
                .build();

        try {
            trainer = userRepository.save(trainer);
        } catch (org.springframework.dao.DuplicateKeyException ex) {
            throw new AppException(ErrorCode.PHONE_ALREADY_REGISTERED, "This phone number is already registered");
        }

        if (otpService != null) {
            otpService.invalidatePendingOtpForPhone(phone);
        }

        // Never log phone numbers in audit log details
        auditLogService.log("TRAINER_CREATED", trainer.getId(),
                "Created trainer: " + trainer.getName() + " with types: " + distinctTypeIds);

        // Optional immediate member assignment
        if (request.getMemberIds() != null && !request.getMemberIds().isEmpty()) {
            AssignMembersRequest assignReq = new AssignMembersRequest();
            assignReq.setTrainerId(trainer.getId());
            assignReq.setMemberIds(request.getMemberIds());
            trainerAssignmentService.assignMembers(assignReq);
        }

        Map<String, TrainerType> allTypes = trainerTypeRepository.findByGymId(gymId).stream()
                .collect(Collectors.toMap(TrainerType::getId, t -> t));

        return mapToResponse(trainer, allTypes);
    }

    @Transactional
    public TrainerResponse updateTrainer(String id, UpdateTrainerRequest request) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        String callerUserId = SecurityUtils.getCurrentUserId();

        User trainer = userRepository.findByIdAndGymId(id, gymId)
                .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                .orElseThrow(() -> new AppException(ErrorCode.TRAINER_NOT_FOUND));

        boolean phoneChanged = false;
        boolean deactivated = false;
        boolean updated = false;
        boolean invalidateSessions = false;

        if (StringUtils.hasText(request.getName())) {
            String trimmedName = request.getName().trim();
            if (trimmedName.length() < 2 || trimmedName.length() > 100) {
                throw new AppException(ErrorCode.VALIDATION_ERROR, "Name must be 2–100 characters");
            }
            trainer.setName(trimmedName);
            updated = true;
        }

        if (request.getTrainerTypeIds() != null) {
            List<String> distinctTypeIds = request.getTrainerTypeIds().stream().distinct().toList();
            validateTrainerTypeIds(gymId, distinctTypeIds);
            trainer.setTrainerTypeIds(new ArrayList<>(distinctTypeIds));
            updated = true;
        }

        if (StringUtils.hasText(request.getPhone())) {
            String newPhone = normalizeAndValidatePhone(request.getPhone());
            if (!newPhone.equals(trainer.getPhone())) {
                if (userRepository.existsByPhone(newPhone)
                        || (gymRepository != null && gymRepository.existsByPhone(newPhone))) {
                    throw new AppException(ErrorCode.PHONE_ALREADY_REGISTERED, "This phone number is already registered");
                }
                trainer.setPhone(newPhone);
                phoneChanged = true;
                invalidateSessions = true;
            }
        }

        if (StringUtils.hasText(request.getStatus()) || request.getActive() != null) {
            boolean targetActive;
            if (StringUtils.hasText(request.getStatus())) {
                if (!"ACTIVE".equalsIgnoreCase(request.getStatus())
                        && !"INACTIVE".equalsIgnoreCase(request.getStatus())) {
                    throw new AppException(ErrorCode.VALIDATION_ERROR, "Status must be ACTIVE or INACTIVE");
                }
                targetActive = "ACTIVE".equalsIgnoreCase(request.getStatus());
            } else {
                targetActive = Boolean.TRUE.equals(request.getActive());
            }

            if (!targetActive) {
                trainer.setActive(false);
                trainer.setStatus("INACTIVE");
                deactivated = true;
                invalidateSessions = true;
            } else {
                trainer.setActive(true);
                trainer.setStatus("ACTIVE");
                updated = true;
            }
        }

        if (invalidateSessions) {
            trainer.setTokenVersion(trainer.getTokenVersion() + 1);
            trainer.setRefreshTokenHash(null);
            if (refreshTokenRepository != null) {
                refreshTokenRepository.deleteByUserId(trainer.getId());
            }
        }

        try {
            trainer = userRepository.save(trainer);
        } catch (org.springframework.dao.DuplicateKeyException ex) {
            throw new AppException(ErrorCode.PHONE_ALREADY_REGISTERED, "This phone number is already registered");
        }

        if (phoneChanged && otpService != null) {
            otpService.invalidatePendingOtpForPhone(trainer.getPhone());
        }

        if (deactivated) {
            trainerAssignmentService.endAllActiveAssignmentsForTrainer(gymId, trainer.getId(), callerUserId);
        }

        // Never include phone numbers in audit log details
        if (phoneChanged) {
            auditLogService.log("TRAINER_PHONE_CHANGED", trainer.getId(),
                    "Changed phone number for trainer: " + trainer.getName());
        }
        if (deactivated) {
            auditLogService.log("TRAINER_DEACTIVATED", trainer.getId(),
                    "Deactivated trainer: " + trainer.getName());
        }
        if (updated) {
            auditLogService.log("TRAINER_UPDATED", trainer.getId(),
                    "Updated trainer: " + trainer.getName());
        }

        Map<String, TrainerType> allTypes = trainerTypeRepository.findByGymId(gymId).stream()
                .collect(Collectors.toMap(TrainerType::getId, t -> t));

        return mapToResponse(trainer, allTypes);
    }

    public List<TrainerResponse> getTrainers(String status) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        List<User> users = userRepository.findByGymIdAndRole(gymId, "TRAINER");

        if (StringUtils.hasText(status) && !"ALL".equalsIgnoreCase(status)) {
            if (!"ACTIVE".equalsIgnoreCase(status) && !"INACTIVE".equalsIgnoreCase(status)) {
                throw new AppException(ErrorCode.VALIDATION_ERROR, "Status filter must be ACTIVE, INACTIVE, or ALL");
            }
            users = users.stream()
                    .filter(u -> status.equalsIgnoreCase(u.getStatus()))
                    .toList();
        }

        Map<String, TrainerType> allTypes = trainerTypeRepository.findByGymId(gymId).stream()
                .collect(Collectors.toMap(TrainerType::getId, t -> t));

        return users.stream().map(u -> mapToResponse(u, allTypes)).toList();
    }

    public TrainerResponse getTrainerById(String id) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        User trainer = userRepository.findByIdAndGymId(id, gymId)
                .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                .orElseThrow(() -> new AppException(ErrorCode.TRAINER_NOT_FOUND));

        Map<String, TrainerType> allTypes = trainerTypeRepository.findByGymId(gymId).stream()
                .collect(Collectors.toMap(TrainerType::getId, t -> t));

        return mapToResponse(trainer, allTypes);
    }

    @Transactional
    public TrainerResponse updateTrainerTypes(String id, List<String> trainerTypeIds) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();

        User trainer = userRepository.findByIdAndGymId(id, gymId)
                .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                .orElseThrow(() -> new AppException(ErrorCode.TRAINER_NOT_FOUND));

        List<String> distinctTypeIds = trainerTypeIds != null
                ? trainerTypeIds.stream().distinct().toList()
                : List.of();
        validateTrainerTypeIds(gymId, distinctTypeIds);

        trainer.setTrainerTypeIds(new ArrayList<>(distinctTypeIds));
        trainer = userRepository.save(trainer);

        auditLogService.log("TRAINER_UPDATED", trainer.getId(),
                "Updated trainer types for " + trainer.getName() + " to: " + distinctTypeIds);

        Map<String, TrainerType> allTypes = trainerTypeRepository.findByGymId(gymId).stream()
                .collect(Collectors.toMap(TrainerType::getId, t -> t));

        return mapToResponse(trainer, allTypes);
    }

    @Transactional
    public TrainerResponse deactivateTrainer(String id) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        String callerUserId = SecurityUtils.getCurrentUserId();

        User trainer = userRepository.findByIdAndGymId(id, gymId)
                .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                .orElseThrow(() -> new AppException(ErrorCode.TRAINER_NOT_FOUND));

        trainer.setActive(false);
        trainer.setStatus("INACTIVE");
        trainer.setTokenVersion(trainer.getTokenVersion() + 1);
        trainer.setRefreshTokenHash(null);
        if (refreshTokenRepository != null) {
            refreshTokenRepository.deleteByUserId(trainer.getId());
        }
        trainer = userRepository.save(trainer);

        // Deactivating automatically ends their active assignments
        trainerAssignmentService.endAllActiveAssignmentsForTrainer(gymId, trainer.getId(), callerUserId);

        auditLogService.log("TRAINER_DEACTIVATED", trainer.getId(), "Deactivated trainer " + trainer.getName());

        Map<String, TrainerType> allTypes = trainerTypeRepository.findByGymId(gymId).stream()
                .collect(Collectors.toMap(TrainerType::getId, t -> t));

        return mapToResponse(trainer, allTypes);
    }

    private void validateTrainerTypeIds(String gymId, List<String> trainerTypeIds) {
        if (trainerTypeIds == null || trainerTypeIds.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "At least one trainer type ID is required");
        }
        List<TrainerType> validTypes = trainerTypeRepository.findByGymIdAndIdIn(gymId, trainerTypeIds);
        if (validTypes.size() != trainerTypeIds.size()) {
            throw new AppException(ErrorCode.TRAINER_TYPE_NOT_FOUND, "One or more trainer types are invalid or not found");
        }
    }

    private String normalizeAndValidatePhone(String rawPhone) {
        String normalized = SendOtpRequest.normalizePhone(rawPhone);
        if (!StringUtils.hasText(normalized) || !INDIAN_PHONE_PATTERN.matcher(normalized).matches()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Enter a valid 10-digit Indian mobile number");
        }
        return normalized;
    }

    private TrainerResponse mapToResponse(User u, Map<String, TrainerType> allTypes) {
        List<TrainerTypeResponse> types = new ArrayList<>();
        if (u.getTrainerTypeIds() != null) {
            for (String tid : u.getTrainerTypeIds()) {
                TrainerType type = allTypes.get(tid);
                if (type != null) {
                    types.add(TrainerTypeResponse.builder()
                            .id(type.getId())
                            .name(type.getName())
                            .active(type.isActive())
                            .build());
                }
            }
        }

        int activeAssignments = trainerAssignmentRepository.findByGymIdAndTrainerIdAndStatus(
                u.getGymId(), u.getId(), "ACTIVE").size();

        String phone = u.getPhone();
        if (!SecurityUtils.isOwner()) {
            phone = PhoneMasker.mask(phone);
        }

        return TrainerResponse.builder()
                .id(u.getId())
                .gymId(u.getGymId())
                .name(u.getName())
                .phone(phone)
                .role(u.getRole())
                .active(u.isActive())
                .status(u.getStatus())
                .trainerTypes(types)
                .activeAssignmentsCount(activeAssignments)
                .createdAt(u.getCreatedAt())
                .build();
    }
}
