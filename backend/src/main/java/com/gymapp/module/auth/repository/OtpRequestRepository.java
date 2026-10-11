package com.gymapp.module.auth.repository;

import com.gymapp.module.auth.entity.OtpRequest;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface OtpRequestRepository extends MongoRepository<OtpRequest, String> {
    Optional<OtpRequest> findByPhone(String phone);
    void deleteByPhone(String phone);
}
