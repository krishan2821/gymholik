package com.gymapp.module.auth.repository;

import com.gymapp.module.auth.entity.LoginAttempt;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface LoginAttemptRepository extends MongoRepository<LoginAttempt, String> {

    Optional<LoginAttempt> findByKey(String key);

    /** Called on successful login to reset the counter. */
    void deleteByKey(String key);
}
