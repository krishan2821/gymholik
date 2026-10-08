package com.gymapp.module.payment.repository;

import com.gymapp.module.payment.entity.Payment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends MongoRepository<Payment, String> {
    List<Payment> findByGymId(String gymId);
    Optional<Payment> findByIdAndGymId(String id, String gymId);
    List<Payment> findByGymIdAndMemberId(String gymId, String memberId);
    Optional<Payment> findByGymIdAndReceiptNo(String gymId, String receiptNo);
    Page<Payment> findByGymId(String gymId, Pageable pageable);
    Page<Payment> findByGymIdAndMode(String gymId, String mode, Pageable pageable);
    Page<Payment> findByGymIdAndPaidAtBetween(String gymId, LocalDateTime start, LocalDateTime end, Pageable pageable);
    Page<Payment> findByGymIdAndModeAndPaidAtBetween(String gymId, String mode, LocalDateTime start, LocalDateTime end, Pageable pageable);
    boolean existsByGymIdAndIdempotencyKey(String gymId, String idempotencyKey);
}
