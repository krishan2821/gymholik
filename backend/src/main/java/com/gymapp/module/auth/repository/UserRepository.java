package com.gymapp.module.auth.repository;

import com.gymapp.module.auth.entity.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByIdAndGymId(String id, String gymId);
    List<User> findByGymId(String gymId);
    List<User> findByGymIdAndRole(String gymId, String role);
    List<User> findByGymIdAndIdIn(String gymId, java.util.Collection<String> ids);
    Optional<User> findByPhone(String phone); // Phone is globally unique for login
    boolean existsByPhone(String phone);
    Optional<User> findByPhoneAndRole(String phone, String role);
}
