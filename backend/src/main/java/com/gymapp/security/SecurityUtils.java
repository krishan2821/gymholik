package com.gymapp.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

public final class SecurityUtils {

    private SecurityUtils() {}

    public static Optional<JwtDetails> getJwtDetails() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getDetails() instanceof JwtDetails jwtDetails) {
            return Optional.of(jwtDetails);
        }
        return Optional.empty();
    }

    public static String getCurrentUserId() {
        return getJwtDetails().map(JwtDetails::getUserId).orElseGet(() -> {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof String principal) {
                return principal;
            }
            return null;
        });
    }

    public static String getCurrentGymId() {
        return getJwtDetails().map(JwtDetails::getGymId).orElse(null);
    }

    public static String getCurrentRole() {
        return getJwtDetails().map(JwtDetails::getRole).orElse(null);
    }

    public static boolean isOwner() {
        String role = getCurrentRole();
        return "OWNER".equalsIgnoreCase(role) || "SUPER_ADMIN".equalsIgnoreCase(role);
    }

    public static boolean isStaff() {
        return "STAFF".equalsIgnoreCase(getCurrentRole());
    }

    public static boolean isTrainer() {
        return "TRAINER".equalsIgnoreCase(getCurrentRole());
    }

    public static boolean isSuperAdmin() {
        return "SUPER_ADMIN".equalsIgnoreCase(getCurrentRole());
    }
}
