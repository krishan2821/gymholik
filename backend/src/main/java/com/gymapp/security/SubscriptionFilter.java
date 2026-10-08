package com.gymapp.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.common.ApiResponse;
import com.gymapp.common.TenantContext;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.repository.GymRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class SubscriptionFilter extends OncePerRequestFilter {

    private final GymRepository gymRepository;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // Skip subscription check for public/auth endpoints, admin endpoints, and swagger, and gym info
        if (path.startsWith("/api/auth/") || path.startsWith("/api/admin/") || (path.equals("/api/gym") && "GET".equalsIgnoreCase(request.getMethod())) || path.startsWith("/v3/api-docs") || path.startsWith("/swagger-ui")) {
            filterChain.doFilter(request, response);
            return;
        }

        String gymId = TenantContext.getGymId();
        if (gymId != null) {
            Gym gym = gymRepository.findById(gymId).orElse(null);
            if (gym != null && gym.getSubscriptionValidTill() != null) {
                // Add 5 days grace period
                LocalDateTime gracePeriodEnd = gym.getSubscriptionValidTill().atStartOfDay().plusDays(5);
                if (LocalDateTime.now().isAfter(gracePeriodEnd)) {
                    sendErrorResponse(response, ErrorCode.SUBSCRIPTION_EXPIRED);
                    return;
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private void sendErrorResponse(HttpServletResponse response, ErrorCode errorCode) throws IOException {
        response.setStatus(errorCode.getHttpStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ApiResponse<Void> apiResponse = ApiResponse.error(errorCode.getDefaultMessage(), errorCode.name());
        response.getWriter().write(objectMapper.writeValueAsString(apiResponse));
    }
}
