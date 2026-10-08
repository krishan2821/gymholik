package com.gymapp.module.auth.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.auth.dto.GymSettingsRequest;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.repository.GymRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GymSettingsService {
    
    private final GymRepository gymRepository;
    private final com.gymapp.module.audit.service.AuditLogService auditLogService;
    
    public Gym getGymSettings() {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access gym settings");
        }

        String gymId = TenantContext.getGymId();
        return gymRepository.findById(gymId)
                .orElseThrow(() -> new AppException(ErrorCode.GYM_NOT_FOUND));
    }
    
    @Transactional
    public Gym updateGymSettings(GymSettingsRequest request) {
        if (com.gymapp.security.SecurityUtils.getCurrentRole() != null && !com.gymapp.security.SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        Gym gym = gymRepository.findById(gymId)
                .orElseThrow(() -> new AppException(ErrorCode.GYM_NOT_FOUND));
                
        gym.setName(request.getName());
        gym.setAddress(request.getAddress());
        gym.setLogoUrl(request.getLogoUrl());
        gym.setAllowExpiredCheckin(request.isAllowExpiredCheckin());
        gym.setReminderDaysBefore(request.getReminderDaysBefore());

        if (request.getStaffCanSeeFullPhone() != null &&
                request.getStaffCanSeeFullPhone() != gym.isStaffCanSeeFullPhone()) {
            boolean previous = gym.isStaffCanSeeFullPhone();
            gym.setStaffCanSeeFullPhone(request.getStaffCanSeeFullPhone());
            auditLogService.log("TOGGLE_STAFF_PHONE_VISIBILITY", gymId,
                    "Changed staffCanSeeFullPhone from " + previous + " to " + request.getStaffCanSeeFullPhone());
        }
        
        return gymRepository.save(gym);
    }
}
