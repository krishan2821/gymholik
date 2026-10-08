package com.gymapp.module.notification.repository;

import com.gymapp.module.notification.entity.ReminderLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface ReminderLogRepository extends MongoRepository<ReminderLog, String> {
    List<ReminderLog> findByGymId(String gymId);
    Optional<ReminderLog> findByIdAndGymId(String id, String gymId);
    Optional<ReminderLog> findByGymIdAndMembershipIdAndType(String gymId, String membershipId, String type);
    boolean existsByGymIdAndMemberIdAndType(String gymId, String memberId, String type);
}
