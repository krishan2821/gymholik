package com.gymapp.module.trainer.repository;

import com.gymapp.module.trainer.entity.TrainerAssignment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TrainerAssignmentRepository extends MongoRepository<TrainerAssignment, String> {
    Optional<TrainerAssignment> findByIdAndGymId(String id, String gymId);
    List<TrainerAssignment> findByGymIdAndTrainerIdAndStatus(String gymId, String trainerId, String status);
    List<TrainerAssignment> findByGymIdAndMemberIdAndStatus(String gymId, String memberId, String status);
    boolean existsByGymIdAndTrainerIdAndMemberIdAndStatus(String gymId, String trainerId, String memberId, String status);
    Optional<TrainerAssignment> findByGymIdAndTrainerIdAndMemberIdAndStatus(String gymId, String trainerId, String memberId, String status);
    List<TrainerAssignment> findByGymIdAndTrainerId(String gymId, String trainerId);
    List<TrainerAssignment> findByGymIdAndMemberId(String gymId, String memberId);
    Page<TrainerAssignment> findByGymId(String gymId, Pageable pageable);
}
