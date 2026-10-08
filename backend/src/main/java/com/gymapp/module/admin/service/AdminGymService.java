package com.gymapp.module.admin.service;

import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.repository.GymRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminGymService {

    private final GymRepository gymRepository;

    public List<Gym> getAllGyms() {
        return gymRepository.findAll();
    }

    public Gym extendSubscription(String gymId, String plan) {
        Gym gym = gymRepository.findById(gymId)
                .orElseThrow(() -> new AppException(ErrorCode.GYM_NOT_FOUND));

        LocalDate currentValidTill = gym.getSubscriptionValidTill() != null 
                ? gym.getSubscriptionValidTill() 
                : LocalDate.now();

        if (currentValidTill.isBefore(LocalDate.now())) {
            currentValidTill = LocalDate.now();
        }
        
        int daysToAdd = "YEARLY".equalsIgnoreCase(plan) ? 365 : 30;

        gym.setSubscriptionValidTill(currentValidTill.plusDays(daysToAdd));
        gym.setSubscriptionPlan(plan.toUpperCase());
        
        if ("TRIAL".equals(gym.getStatus()) || "EXPIRED".equals(gym.getStatus())) {
            gym.setStatus("ACTIVE");
        }
        
        return gymRepository.save(gym);
    }

    public Gym suspendGym(String gymId) {
        Gym gym = gymRepository.findById(gymId).orElseThrow(() -> new AppException(ErrorCode.GYM_NOT_FOUND));
        gym.setStatus("SUSPENDED");
        return gymRepository.save(gym);
    }

    public Gym reactivateGym(String gymId) {
        Gym gym = gymRepository.findById(gymId).orElseThrow(() -> new AppException(ErrorCode.GYM_NOT_FOUND));
        gym.setStatus("ACTIVE");
        return gymRepository.save(gym);
    }
}
