package com.gymapp.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Stateless JWT utility — only builds and validates access tokens.
 * Refresh tokens are opaque UUIDs stored in MongoDB (see RefreshToken entity).
 */
@Slf4j
@Component
public class JwtUtil {

    private final SecretKey key;

    @Getter
    private final long accessTokenExpiryMs;

    public JwtUtil(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.access-token-expiry-ms}") long accessTokenExpiryMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpiryMs = accessTokenExpiryMs;
    }

    /**
     * Builds a signed HS256 access token.
     *
     * @param userId  MongoDB _id of the user
     * @param gymId   MongoDB _id of the gym (null for SUPER_ADMIN)
     * @param role    User.Role name (OWNER | STAFF | SUPER_ADMIN)
     */
    public String generateAccessToken(String userId, String gymId, String role) {
        return Jwts.builder()
                .subject(userId)
                .claim("gymId", gymId)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + accessTokenExpiryMs))
                .signWith(key)
                .compact();
    }

    /**
     * Parses and verifies the token, returning the claims payload.
     * Throws {@link JwtException} subclasses on any failure.
     */
    public Claims validateAndExtractClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /**
     * Returns true only if the token signature is valid AND it has not expired.
     */
    public boolean isTokenValid(String token) {
        try {
            validateAndExtractClaims(token);
            return true;
        } catch (ExpiredJwtException ex) {
            log.debug("JWT expired: {}", ex.getMessage());
        } catch (JwtException ex) {
            log.warn("Invalid JWT: {}", ex.getMessage());
        }
        return false;
    }
}
