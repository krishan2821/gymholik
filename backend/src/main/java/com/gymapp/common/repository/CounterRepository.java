package com.gymapp.common.repository;

import com.gymapp.common.entity.Counter;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface CounterRepository extends MongoRepository<Counter, String> {
    Optional<Counter> findByGymIdAndSequenceName(String gymId, String sequenceName);
}
