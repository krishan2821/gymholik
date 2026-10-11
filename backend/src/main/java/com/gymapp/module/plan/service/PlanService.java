package com.gymapp.module.plan.service;

import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.plan.dto.PlanRequest;
import com.gymapp.module.plan.dto.PlanResponse;
import com.gymapp.module.plan.entity.Plan;
import com.gymapp.module.plan.repository.PlanRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlanService {

    private final PlanRepository planRepository;

    public record DefaultPlanSpec(String name, int durationDays, long pricePaise) {}

    public static final List<DefaultPlanSpec> DEFAULT_PLANS = List.of(
            new DefaultPlanSpec("Monthly", 30, 150000L),
            new DefaultPlanSpec("Quarterly", 90, 400000L),
            new DefaultPlanSpec("Half-Yearly", 180, 750000L),
            new DefaultPlanSpec("Annual", 365, 1200000L)
    );

    public void seedDefaultsForGym(String gymId) {
        for (DefaultPlanSpec spec : DEFAULT_PLANS) {
            if (!planRepository.existsByGymIdAndNameAndActive(gymId, spec.name(), true)) {
                Plan plan = Plan.builder()
                        .gymId(gymId)
                        .name(spec.name())
                        .durationDays(spec.durationDays())
                        .pricePaise(spec.pricePaise())
                        .active(true)
                        .build();
                planRepository.save(plan);
            }
        }
        log.info("Seeded default plans for gymId={}", gymId);
    }

    // ── Public API ────────────────────────────────────────────────────────────


    public PlanResponse createPlan(PlanRequest request) {
        if (com.gymapp.security.SecurityUtils.getCurrentRole() != null && !com.gymapp.security.SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();

        // Enforce unique plan name within active plans of this gym
        if (planRepository.existsByGymIdAndNameAndActive(gymId, request.getName(), true)) {
            throw new AppException(ErrorCode.PLAN_NAME_EXISTS);
        }

        Plan plan = Plan.builder()
                .gymId(gymId)
                .name(request.getName())
                .durationDays(request.getDurationDays())
                .pricePaise(request.getPricePaise())
                .active(true)
                .build();

        plan = planRepository.save(plan);
        log.info("Plan created: id={}, gymId={}, name={}", plan.getId(), gymId, plan.getName());
        return toResponse(plan);
    }

    public List<PlanResponse> getAllPlans() {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access plans");
        }

        String gymId = TenantContext.getGymId();
        return planRepository.findByGymIdAndActive(gymId, true)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    public PlanResponse getPlanById(String planId) {
        if (com.gymapp.security.SecurityUtils.isTrainer()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Trainers cannot access plans");
        }

        return toResponse(findPlanInGym(planId));
    }

    public PlanResponse updatePlan(String planId, PlanRequest request) {
        if (com.gymapp.security.SecurityUtils.getCurrentRole() != null && !com.gymapp.security.SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();
        Plan plan = findPlanInGym(planId);

        // Check name collision only if the name is actually changing
        if (!plan.getName().equalsIgnoreCase(request.getName())
                && planRepository.existsByGymIdAndNameAndActiveAndIdNot(
                        gymId, request.getName(), true, planId)) {
            throw new AppException(ErrorCode.PLAN_NAME_EXISTS);
        }

        plan.setName(request.getName());
        plan.setDurationDays(request.getDurationDays());
        plan.setPricePaise(request.getPricePaise());

        plan = planRepository.save(plan);
        log.info("Plan updated: id={}", planId);
        return toResponse(plan);
    }

    /**
     * Soft-delete: marks plan inactive.
     * Existing memberships that reference this plan are unaffected because
     * they snapshot planName + price at purchase time.
     */
    public void deletePlan(String planId) {
        if (com.gymapp.security.SecurityUtils.getCurrentRole() != null && !com.gymapp.security.SecurityUtils.isOwner()) {
            throw new AppException(ErrorCode.ACCESS_DENIED, "Access denied");
        }

        Plan plan = findPlanInGym(planId);
        plan.setActive(false);
        planRepository.save(plan);
        log.info("Plan soft-deleted: id={}", planId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Tenant-safe plan lookup.
     * Always includes gymId from TenantContext — never trusts caller to provide it.
     */
    public Plan findPlanInGym(String planId) {
        String gymId = TenantContext.getGymId();
        return planRepository.findByIdAndGymId(planId, gymId)
                .orElseThrow(() -> new AppException(ErrorCode.PLAN_NOT_FOUND));
    }

    private PlanResponse toResponse(Plan plan) {
        // Format paise → "₹X,XXX.XX"
        String priceFormatted = String.format("₹%,.2f", plan.getPricePaise() / 100.0);
        return PlanResponse.builder()
                .id(plan.getId())
                .gymId(plan.getGymId())
                .name(plan.getName())
                .durationDays(plan.getDurationDays())
                .pricePaise(plan.getPricePaise())
                .priceFormatted(priceFormatted)
                .createdAt(plan.getCreatedAt())
                .updatedAt(plan.getUpdatedAt())
                .build();
    }
}
