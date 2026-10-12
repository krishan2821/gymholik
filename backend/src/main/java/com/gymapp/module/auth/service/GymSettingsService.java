package com.gymapp.module.auth.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.audit.service.AuditLogService;
import com.gymapp.module.auth.dto.CompleteRegistrationRequest;
import com.gymapp.module.auth.dto.GymProfileResponse;
import com.gymapp.module.auth.dto.GymSettingsRequest;
import com.gymapp.module.auth.dto.UpdateGymProfileRequest;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.entity.GymAddress;
import com.gymapp.module.auth.repository.GymRepository;
import com.gymapp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class GymSettingsService {

    private static final Pattern UDYAM_PATTERN = Pattern.compile("^UDYAM-[A-Z]{2}-\\d{2}-\\d{7}$");
    private static final Pattern GSTIN_PATTERN = Pattern.compile("^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");
    private static final Pattern NIC_PATTERN = Pattern.compile("^\\d{4,5}$");

    private final GymRepository gymRepository;
    private final AuditLogService auditLogService;

    public Gym getGymSettings() {
        if (SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access gym settings");
        }

        String gymId = TenantContext.getGymId();
        Gym gym = gymRepository.findById(gymId)
                .orElseThrow(() -> new AppException(ErrorCode.GYM_NOT_FOUND));

        // For backward compat GET /api/gym: STAFF should NOT get gymCode or legalIdNumber/legalIdType
        if (!SecurityUtils.isOwner()) {
            return Gym.builder()
                    .id(gym.getId())
                    .name(gym.getName())
                    .ownerName(gym.getOwnerName())
                    .phone(gym.getPhone())
                    .address(gym.getAddress())
                    .logoUrl(gym.getLogoUrl())
                    .status(gym.getStatus())
                    .subscriptionPlan(gym.getSubscriptionPlan())
                    .subscriptionValidTill(gym.getSubscriptionValidTill())
                    .allowExpiredCheckin(gym.isAllowExpiredCheckin())
                    .reminderDaysBefore(gym.getReminderDaysBefore())
                    .staffCanSeeFullPhone(gym.isStaffCanSeeFullPhone())
                    .createdAt(gym.getCreatedAt())
                    .updatedAt(gym.getUpdatedAt())
                    .version(gym.getVersion())
                    .build();
        }

        return gym;
    }

    @Transactional
    public Gym updateGymSettings(GymSettingsRequest request) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
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

    public GymProfileResponse getGymProfile(boolean reveal) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        Gym gym = gymRepository.findById(gymId)
                .orElseThrow(() -> new AppException(ErrorCode.GYM_NOT_FOUND));

        String legalIdNumber = gym.getLegalIdNumber();
        if (reveal) {
            // Audit entry without sensitive value in details
            auditLogService.log("LEGAL_ID_VIEWED", gymId, "Legal ID was revealed by owner");
        } else if (StringUtils.hasText(legalIdNumber)) {
            legalIdNumber = maskLegalIdNumber(legalIdNumber);
        }

        Long daysRemaining = null;
        if (gym.getSubscriptionValidTill() != null) {
            LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
            daysRemaining = Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(today, gym.getSubscriptionValidTill()));
        }

        return GymProfileResponse.builder()
                .id(gym.getId())
                .name(gym.getName())
                .gymCode(gym.getGymCode())
                .gymType(gym.getGymType())
                .status(gym.getStatus())
                .subscriptionValidTill(gym.getSubscriptionValidTill())
                .daysRemaining(daysRemaining)
                .legalIdVerified(gym.isLegalIdVerified())
                .legalIdType(gym.getLegalIdType())
                .legalIdNumber(legalIdNumber)
                .address(gym.getAddress())
                .logoUrl(gym.getLogoUrl())
                .allowExpiredCheckin(gym.isAllowExpiredCheckin())
                .reminderDaysBefore(gym.getReminderDaysBefore())
                .staffCanSeeFullPhone(gym.isStaffCanSeeFullPhone())
                .build();
    }

    @Transactional
    public GymProfileResponse updateGymProfile(UpdateGymProfileRequest request) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        Gym gym = gymRepository.findById(gymId)
                .orElseThrow(() -> new AppException(ErrorCode.GYM_NOT_FOUND));

        validateProfileFields(request);

        gym.setName(request.getName().trim());
        gym.setGymType(request.getGymType());

        CompleteRegistrationRequest.AddressDto addrDto = request.getAddress();
        GymAddress address = GymAddress.builder()
                .line1(addrDto.getLine1().trim())
                .line2(StringUtils.hasText(addrDto.getLine2()) ? addrDto.getLine2().trim() : null)
                .state(IndianStates.canonicalName(addrDto.getState()))
                .district(addrDto.getDistrict().trim())
                .pincode(addrDto.getPincode().trim())
                .build();
        gym.setAddress(address);

        gym.setLegalIdType(request.getLegalIdType());
        gym.setLegalIdNumber(StringUtils.hasText(request.getLegalIdNumber())
                ? request.getLegalIdNumber().trim().toUpperCase()
                : null);

        // gymCode and legalIdVerified CANNOT be changed
        gym = gymRepository.save(gym);

        auditLogService.log("GYM_PROFILE_UPDATED", gymId, "Gym profile details updated");

        String maskedLegalId = gym.getLegalIdNumber();
        if (StringUtils.hasText(maskedLegalId)) {
            maskedLegalId = maskLegalIdNumber(maskedLegalId);
        }

        Long daysRemaining = null;
        if (gym.getSubscriptionValidTill() != null) {
            LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
            daysRemaining = Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(today, gym.getSubscriptionValidTill()));
        }

        return GymProfileResponse.builder()
                .id(gym.getId())
                .name(gym.getName())
                .gymCode(gym.getGymCode())
                .gymType(gym.getGymType())
                .status(gym.getStatus())
                .subscriptionValidTill(gym.getSubscriptionValidTill())
                .daysRemaining(daysRemaining)
                .legalIdVerified(gym.isLegalIdVerified())
                .legalIdType(gym.getLegalIdType())
                .legalIdNumber(maskedLegalId)
                .address(gym.getAddress())
                .logoUrl(gym.getLogoUrl())
                .allowExpiredCheckin(gym.isAllowExpiredCheckin())
                .reminderDaysBefore(gym.getReminderDaysBefore())
                .staffCanSeeFullPhone(gym.isStaffCanSeeFullPhone())
                .build();
    }

    private void validateProfileFields(UpdateGymProfileRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();

        if (request.getAddress() != null && StringUtils.hasText(request.getAddress().getState())) {
            if (!IndianStates.isValidState(request.getAddress().getState())) {
                fieldErrors.put("address.state", "State must be a valid Indian state or UT");
            }
        }

        boolean hasLegalType = request.getLegalIdType() != null;
        boolean hasLegalNumber = StringUtils.hasText(request.getLegalIdNumber());

        if (hasLegalType != hasLegalNumber) {
            if (!hasLegalType) {
                fieldErrors.put("legalIdType", "legalIdType is required when legalIdNumber is provided");
            }
            if (!hasLegalNumber) {
                fieldErrors.put("legalIdNumber", "legalIdNumber is required when legalIdType is provided");
            }
        } else if (hasLegalType) {
            String idNum = request.getLegalIdNumber().trim().toUpperCase();
            switch (request.getLegalIdType()) {
                case UDYAM -> {
                    if (!UDYAM_PATTERN.matcher(idNum).matches()) {
                        fieldErrors.put("legalIdNumber", "UDYAM format is invalid (expected UDYAM-XX-00-0000000)");
                    }
                }
                case GSTIN -> {
                    if (!GSTIN_PATTERN.matcher(idNum).matches()) {
                        fieldErrors.put("legalIdNumber", "GSTIN format is invalid");
                    }
                }
                case NIC -> {
                    if (!NIC_PATTERN.matcher(idNum).matches()) {
                        fieldErrors.put("legalIdNumber", "NIC format is invalid (expected 4-5 digits)");
                    }
                }
            }
        }

        if (!fieldErrors.isEmpty()) {
            throw new AppException(ErrorCode.VALIDATION_ERROR, "Validation failed", fieldErrors);
        }
    }

    private String maskLegalIdNumber(String val) {
        if (!StringUtils.hasText(val)) {
            return val;
        }
        String trimmed = val.trim();
        if (trimmed.length() <= 4) {
            return trimmed;
        }
        String last4 = trimmed.substring(trimmed.length() - 4);
        return "*".repeat(trimmed.length() - 4) + last4;
    }
}
