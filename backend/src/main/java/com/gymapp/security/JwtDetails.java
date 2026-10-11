package com.gymapp.security;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * Attached to the Spring {@link org.springframework.security.authentication.UsernamePasswordAuthenticationToken}
 * as the "details" object so services can retrieve JWT claims without
 * re-parsing the token.
 */
@Getter
@AllArgsConstructor
public class JwtDetails {
    private final String userId;
    private final String gymId;   // null for SUPER_ADMIN or REGISTER scope
    private final String role;    // null for REGISTER scope
    private final String phone;
    private final String scope;

    public JwtDetails(String userId, String gymId, String role) {
        this(userId, gymId, role, null, null);
    }
}
