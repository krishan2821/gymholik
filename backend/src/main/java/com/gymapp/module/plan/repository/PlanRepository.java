package com.gymapp.module.plan.repository;

import com.gymapp.module.plan.entity.Plan;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface PlanRepository extends MongoRepository<Plan, String> {
    List<Plan> findByGymId(String gymId);
    List<Plan> findByGymIdAndActive(String gymId, boolean active);
    Optional<Plan> findByIdAndGymId(String id, String gymId);
    boolean existsByIdAndGymId(String id, String gymId);
    boolean existsByGymIdAndNameAndActive(String gymId, String name, boolean active);
    boolean existsByGymIdAndNameAndActiveAndIdNot(String gymId, String name, boolean active, String idNot);
}
