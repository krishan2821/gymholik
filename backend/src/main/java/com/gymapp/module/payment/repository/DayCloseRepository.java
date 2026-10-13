package com.gymapp.module.payment.repository;

import com.gymapp.module.payment.entity.DayClose;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface DayCloseRepository extends MongoRepository<DayClose, String> {
    Optional<DayClose> findByGymIdAndDate(String gymId, LocalDate date);
    boolean existsByGymIdAndDate(String gymId, LocalDate date);
}
