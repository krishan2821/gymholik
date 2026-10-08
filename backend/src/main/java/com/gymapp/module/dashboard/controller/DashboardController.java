package com.gymapp.module.dashboard.controller;

import com.gymapp.common.ApiResponse;
import com.gymapp.module.dashboard.dto.DashboardResponse;
import com.gymapp.module.dashboard.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard", description = "Gym statistics and metrics")
@SecurityRequirement(name = "bearerAuth")
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER', 'STAFF')")
    @Operation(summary = "Get dashboard metrics")
    public ResponseEntity<ApiResponse<DashboardResponse>> getDashboard() {
        DashboardResponse response = dashboardService.getDashboardData();
        
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isOwner = auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_OWNER") || a.getAuthority().equals("ROLE_SUPER_ADMIN"));
                
        if (!isOwner) {
            response.setTodayCollection(null);
            response.setMonthCollection(null);
            response.setTotalDue(null);
            response.setLast7DaysCollection(null);
        }
        
        return ResponseEntity.ok(ApiResponse.success("Dashboard data fetched successfully", response));
    }
}
