package com.gymapp.module.trainer.service;

import com.gymapp.common.PhoneMasker;
import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.audit.service.AuditLogService;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.trainer.dto.ApproveTrainerRequest;
import com.gymapp.module.trainer.dto.TrainerResponse;
import com.gymapp.module.trainer.dto.TrainerTypeResponse;
import com.gymapp.module.trainer.entity.TrainerType;
import com.gymapp.module.trainer.repository.TrainerAssignmentRepository;
import com.gymapp.module.trainer.repository.TrainerTypeRepository;
import com.gymapp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TrainerService {

    private final UserRepository userRepository;
    private final TrainerTypeRepository trainerTypeRepository;
    private final TrainerAssignmentRepository trainerAssignmentRepository;
    private final TrainerAssignmentService trainerAssignmentService;
    private final AuditLogService auditLogService;

    public List<TrainerResponse> getTrainers(String status) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        List<User> users = userRepository.findByGymIdAndRole(gymId, "TRAINER");

        if (StringUtils.hasText(status) && !"ALL".equalsIgnoreCase(status)) {
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
    public TrainerResponse approveTrainer(String id, ApproveTrainerRequest request) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        String callerUserId = SecurityUtils.getCurrentUserId();

        User trainer = userRepository.findByIdAndGymId(id, gymId)
                .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                .orElseThrow(() -> new AppException(ErrorCode.TRAINER_NOT_FOUND));

        validateTrainerTypeIds(gymId, request.getTrainerTypeIds());

        trainer.setActive(true);
        trainer.setStatus("ACTIVE");
        trainer.setTrainerTypeIds(new ArrayList<>(request.getTrainerTypeIds()));
        trainer = userRepository.save(trainer);

        auditLogService.log("APPROVE_TRAINER", trainer.getId(),
                "Approved trainer " + trainer.getName() + " with types: " + request.getTrainerTypeIds());

        Map<String, TrainerType> allTypes = trainerTypeRepository.findByGymId(gymId).stream()
                .collect(Collectors.toMap(TrainerType::getId, t -> t));

        return mapToResponse(trainer, allTypes);
    }

    @Transactional
    public TrainerResponse rejectTrainer(String id) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        String callerUserId = SecurityUtils.getCurrentUserId();

        User trainer = userRepository.findByIdAndGymId(id, gymId)
                .filter(u -> "TRAINER".equalsIgnoreCase(u.getRole()))
                .orElseThrow(() -> new AppException(ErrorCode.TRAINER_NOT_FOUND));

        trainer.setActive(false);
        trainer.setStatus("REJECTED");
        trainer = userRepository.save(trainer);

        // Deactivating or rejecting automatically ends their active assignments
        trainerAssignmentService.endAllActiveAssignmentsForTrainer(gymId, trainer.getId(), callerUserId);

        auditLogService.log("REJECT_TRAINER", trainer.getId(), "Rejected trainer " + trainer.getName());

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

        validateTrainerTypeIds(gymId, trainerTypeIds);

        trainer.setTrainerTypeIds(new ArrayList<>(trainerTypeIds));
        trainer = userRepository.save(trainer);

        auditLogService.log("UPDATE_TRAINER_TYPES", trainer.getId(),
                "Updated trainer types for " + trainer.getName() + " to: " + trainerTypeIds);

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
        trainer = userRepository.save(trainer);

        // Deactivating automatically ends their active assignments
        trainerAssignmentService.endAllActiveAssignmentsForTrainer(gymId, trainer.getId(), callerUserId);

        auditLogService.log("DEACTIVATE_TRAINER", trainer.getId(), "Deactivated trainer " + trainer.getName());

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
