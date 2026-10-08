package com.gymapp.module.attendance.repository;

import com.gymapp.module.attendance.entity.Attendance;
import com.gymapp.module.attendance.entity.Attendance;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AttendanceRepository extends MongoRepository<Attendance, String> {
    List<Attendance> findByGymId(String gymId);
    Optional<Attendance> findByIdAndGymId(String id, String gymId);
    List<Attendance> findByGymIdAndMemberId(String gymId, String memberId);
    Page<Attendance> findByGymIdAndMemberId(String gymId, String memberId, Pageable pageable);
    Optional<Attendance> findByGymIdAndMemberIdAndDate(String gymId, String memberId, LocalDate date);
    boolean existsByGymIdAndMemberIdAndDate(String gymId, String memberId, LocalDate date);
    Page<Attendance> findByGymIdAndDate(String gymId, LocalDate date, Pageable pageable);
}
