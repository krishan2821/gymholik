package com.gymapp.module.trainer.repository;

import com.gymapp.module.trainer.entity.TrainerType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface TrainerTypeRepository extends MongoRepository<TrainerType, String> {
    Optional<TrainerType> findByIdAndGymId(String id, String gymId);
    List<TrainerType> findByGymId(String gymId);
    List<TrainerType> findByGymIdAndActive(String gymId, boolean active);
    boolean existsByGymIdAndNameIgnoreCase(String gymId, String name);
    List<TrainerType> findByGymIdAndIdIn(String gymId, Collection<String> ids);
}
