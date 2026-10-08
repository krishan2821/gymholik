package com.gymapp.module.trainer.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.audit.service.AuditLogService;
import com.gymapp.module.trainer.dto.TrainerTypeRequest;
import com.gymapp.module.trainer.dto.TrainerTypeResponse;
import com.gymapp.module.trainer.entity.TrainerType;
import com.gymapp.module.trainer.repository.TrainerTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TrainerTypeService {

    private final TrainerTypeRepository trainerTypeRepository;
    private final AuditLogService auditLogService;

    public static final List<String> DEFAULT_TYPES = List.of(
            "Personal Trainer",
            "Cardio Trainer",
            "Zumba Trainer",
            "Yoga Trainer",
            "CrossFit Trainer",
            "General"
    );

    public void seedDefaultsForGym(String gymId) {
        for (String typeName : DEFAULT_TYPES) {
            if (!trainerTypeRepository.existsByGymIdAndNameIgnoreCase(gymId, typeName)) {
                TrainerType type = TrainerType.builder()
                        .gymId(gymId)
                        .name(typeName)
                        .active(true)
                        .build();
                trainerTypeRepository.save(type);
            }
        }
        log.info("Seeded default trainer types for gymId={}", gymId);
    }

    @Transactional
    public TrainerTypeResponse createTrainerType(TrainerTypeRequest request) {
        if (com.gymapp.security.SecurityUtils.getCurrentRole() != null && !com.gymapp.security.SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        if (trainerTypeRepository.existsByGymIdAndNameIgnoreCase(gymId, request.getName().trim())) {
            throw new AppException(ErrorCode.TRAINER_TYPE_EXISTS);
        }

        TrainerType type = TrainerType.builder()
                .gymId(gymId)
                .name(request.getName().trim())
                .active(request.getActive() != null ? request.getActive() : true)
                .build();
        type = trainerTypeRepository.save(type);

        auditLogService.log("CREATE_TRAINER_TYPE", type.getId(), "Created trainer type: " + type.getName());
        return mapToResponse(type);
    }

    public List<TrainerTypeResponse> getTrainerTypes(Boolean activeOnly) {
        if (com.gymapp.security.SecurityUtils.getCurrentRole() != null && !com.gymapp.security.SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        List<TrainerType> types;
        if (Boolean.TRUE.equals(activeOnly)) {
            types = trainerTypeRepository.findByGymIdAndActive(gymId, true);
        } else {
            types = trainerTypeRepository.findByGymId(gymId);
        }
        return types.stream().map(this::mapToResponse).toList();
    }

    public TrainerTypeResponse getTrainerTypeById(String id) {
        if (com.gymapp.security.SecurityUtils.getCurrentRole() != null && !com.gymapp.security.SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        TrainerType type = trainerTypeRepository.findByIdAndGymId(id, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.TRAINER_TYPE_NOT_FOUND));
        return mapToResponse(type);
    }

    @Transactional
    public TrainerTypeResponse updateTrainerType(String id, TrainerTypeRequest request) {
        if (com.gymapp.security.SecurityUtils.getCurrentRole() != null && !com.gymapp.security.SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        TrainerType type = trainerTypeRepository.findByIdAndGymId(id, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.TRAINER_TYPE_NOT_FOUND));

        if (!type.getName().equalsIgnoreCase(request.getName().trim())) {
            if (trainerTypeRepository.existsByGymIdAndNameIgnoreCase(gymId, request.getName().trim())) {
                throw new AppException(ErrorCode.TRAINER_TYPE_EXISTS);
            }
        }

        type.setName(request.getName().trim());
        if (request.getActive() != null) {
            type.setActive(request.getActive());
        }
        type = trainerTypeRepository.save(type);

        auditLogService.log("UPDATE_TRAINER_TYPE", type.getId(), "Updated trainer type: " + type.getName() + " active=" + type.isActive());
        return mapToResponse(type);
    }

    @Transactional
    public void deleteTrainerType(String id) {
        if (com.gymapp.security.SecurityUtils.getCurrentRole() != null && !com.gymapp.security.SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        TrainerType type = trainerTypeRepository.findByIdAndGymId(id, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.TRAINER_TYPE_NOT_FOUND));
        type.setActive(false);
        trainerTypeRepository.save(type);
        auditLogService.log("DELETE_TRAINER_TYPE", type.getId(), "Deactivated trainer type: " + type.getName());
    }

    private TrainerTypeResponse mapToResponse(TrainerType type) {
        return TrainerTypeResponse.builder()
                .id(type.getId())
                .name(type.getName())
                .active(type.isActive())
                .build();
    }
}
