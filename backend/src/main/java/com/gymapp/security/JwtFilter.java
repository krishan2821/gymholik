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

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        try {
            String token = extractBearerToken(request);

            if (StringUtils.hasText(token) && jwtUtil.isTokenValid(token)) {
                Claims claims = jwtUtil.validateAndExtractClaims(token);
                String userId = claims.getSubject();
                String gymId  = claims.get("gymId", String.class);   // null for SUPER_ADMIN
                String role   = claims.get("role",  String.class);

                // Set tenant context so service layer can use it without needing
                // to re-parse the token or inject the principal everywhere.
                TenantContext.setGymId(gymId);

                // Build Spring Security authentication principal
                var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
                var auth = new UsernamePasswordAuthenticationToken(userId, null, authorities);
                auth.setDetails(new JwtDetails(userId, gymId, role));
                SecurityContextHolder.getContext().setAuthentication(auth);
            }

            chain.doFilter(request, response);

        } finally {
            // Always clear – even if an exception escapes the filter chain.
            TenantContext.clear();
            SecurityContextHolder.clearContext();
        }
    }

    private String extractBearerToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7).strip();
        }
        return null;
    }
}
