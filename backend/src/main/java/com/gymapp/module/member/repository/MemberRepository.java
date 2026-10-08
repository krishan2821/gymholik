package com.gymapp.module.member.repository;

import com.gymapp.module.member.entity.Member;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.Query;
import java.util.List;
import java.util.Optional;

public interface MemberRepository extends MongoRepository<Member, String> {
    List<Member> findByGymId(String gymId);
    Optional<Member> findByIdAndGymId(String id, String gymId);
    List<Member> findByGymIdAndIdIn(String gymId, java.util.Collection<String> ids);
    Optional<Member> findByGymIdAndPhone(String gymId, String phone);
    Optional<Member> findByGymIdAndMemberCode(String gymId, String memberCode);
    boolean existsByGymIdAndPhone(String gymId, String phone);
    boolean existsByGymIdAndMemberCode(String gymId, String memberCode);
    Page<Member> findByGymIdAndStatus(String gymId, String status, Pageable pageable);
    
    @Query("{ 'gymId': ?0, '$or': [ { 'name': { $regex: ?1, $options: 'i' } }, { 'phone': { $regex: ?1, $options: 'i' } } ] }")
    Page<Member> searchByNameOrPhone(String gymId, String search, Pageable pageable);
}
