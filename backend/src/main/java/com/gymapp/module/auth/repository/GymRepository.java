package com.gymapp.module.auth.repository;

import com.gymapp.module.auth.entity.Gym;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface GymRepository extends MongoRepository<Gym, String> {
    Optional<Gym> findByPhone(String phone);
    boolean existsByPhone(String phone);
    Optional<Gym> findByGymCode(String gymCode);
    boolean existsByGymCode(String gymCode);
}
