package com.gymapp.module.auth.repository;

import com.gymapp.module.auth.entity.RefreshToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface RefreshTokenRepository extends MongoRepository<RefreshToken, String> {

    Optional<RefreshToken> findByToken(String token);

    /** Bulk-revoke all tokens for a user (logout-all / account deactivation). */
    void deleteByUserId(String userId);

    void deleteByToken(String token);
}
