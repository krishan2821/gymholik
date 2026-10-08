package com.gymapp.module.member.repository;

import com.gymapp.module.member.entity.Membership;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface MembershipRepository extends MongoRepository<Membership, String> {
    List<Membership> findByGymId(String gymId);
    Optional<Membership> findByIdAndGymId(String id, String gymId);
    List<Membership> findByGymIdAndMemberId(String gymId, String memberId);
    Optional<Membership> findTopByMemberIdAndGymIdOrderByExpiryDateDesc(String memberId, String gymId);
}
