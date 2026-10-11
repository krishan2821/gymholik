package com.gymapp.security;

import com.gymapp.common.TenantContext;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Per-request JWT filter that:
 * 1. Extracts the Bearer token from the Authorization header.
 * 2. Validates signature + expiry.
 * 3. Populates {@link TenantContext} with gymId for the duration of the request.
 * 4. Populates {@link SecurityContextHolder} so @PreAuthorize works downstream.
 *
 * TenantContext is always cleared in the finally block to prevent ThreadLocal leaks
 * in pooled servlet threads.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final com.gymapp.module.auth.repository.UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        try {
            String token = extractBearerToken(request);

            if (StringUtils.hasText(token) && jwtUtil.isTokenValid(token)) {
                Claims claims = jwtUtil.validateAndExtractClaims(token);
                String scope = claims.get("scope", String.class);

                if ("REGISTER".equals(scope)) {
                    // Reject any REGISTER token that attempts to smuggle role or gymId claims
                    if (claims.get("role") != null || claims.get("gymId") != null) {
                        log.warn("Rejected REGISTER token containing forbidden role or gymId claims");
                    } else {
                        String phone = claims.get("phone", String.class);
                        if (!StringUtils.hasText(phone)) {
                            phone = claims.getSubject();
                        }
                        var authorities = List.of(new SimpleGrantedAuthority("SCOPE_REGISTER"));
                        var auth = new UsernamePasswordAuthenticationToken(phone, token, authorities);
                        auth.setDetails(new JwtDetails(null, null, null, phone, "REGISTER"));
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    }
                } else if (!StringUtils.hasText(scope)) {
                    String userId = claims.getSubject();
                    String gymId  = claims.get("gymId", String.class);   // null for SUPER_ADMIN
                    String role   = claims.get("role",  String.class);
                    Integer tokenVersionClaim = claims.get("tokenVersion", Integer.class);
                    int claimVersion = tokenVersionClaim != null ? tokenVersionClaim : 0;

                    if (StringUtils.hasText(role) && isSessionValid(userId, gymId, role, claimVersion)) {
                        // Set tenant context so service layer can use it without needing
                        // to re-parse the token or inject the principal everywhere.
                        TenantContext.setGymId(gymId);

                        // Build Spring Security authentication principal
                        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
                        var auth = new UsernamePasswordAuthenticationToken(userId, null, authorities);
                        auth.setDetails(new JwtDetails(userId, gymId, role));
                        SecurityContextHolder.getContext().setAuthentication(auth);
                    }
                }
            }

            chain.doFilter(request, response);

        } finally {
            // Always clear – even if an exception escapes the filter chain.
            TenantContext.clear();
            SecurityContextHolder.clearContext();
        }
    }

    private boolean isSessionValid(String userId, String gymId, String role, int claimVersion) {
        if (userRepository == null || !StringUtils.hasText(userId)) {
            return false;
        }
        var userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty()) {
            return false;
        }
        var user = userOpt.get();
        if (!user.isActive() || "INACTIVE".equalsIgnoreCase(user.getStatus())) {
            return false;
        }
        if (user.getTokenVersion() != claimVersion) {
            return false;
        }
        if (!role.equals(user.getRole())) {
            return false;
        }
        return java.util.Objects.equals(gymId, user.getGymId());
    }


    private String extractBearerToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7).strip();
        }
        return null;
    }
}
