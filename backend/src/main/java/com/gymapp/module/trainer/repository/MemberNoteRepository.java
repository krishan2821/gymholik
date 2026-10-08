package com.gymapp.module.trainer.repository;

import com.gymapp.module.trainer.entity.MemberNote;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MemberNoteRepository extends MongoRepository<MemberNote, String> {
    Optional<MemberNote> findByIdAndGymId(String id, String gymId);
    List<MemberNote> findByGymIdAndMemberIdOrderByCreatedAtDesc(String gymId, String memberId);
    Page<MemberNote> findByGymIdAndMemberId(String gymId, String memberId, Pageable pageable);
}
