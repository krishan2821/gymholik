package com.gymapp.module.audit.service;

import com.gymapp.common.PagedResponse;
import com.gymapp.common.TenantContext;
import com.gymapp.module.audit.entity.AuditLog;
import com.gymapp.module.audit.repository.AuditLogRepository;
import com.gymapp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final MongoTemplate mongoTemplate;

    public void log(String action, String targetId, String details) {
        String gymId = TenantContext.getGymId();
        String actorId = SecurityUtils.getCurrentUserId();
        String actorRole = SecurityUtils.getCurrentRole();
        log(gymId, actorId, actorRole, action, targetId, details);
    }

    public void log(String gymId, String actorId, String actorRole, String action, String targetId, String details) {
        AuditLog auditLog = AuditLog.builder()
                .gymId(gymId)
                .actorId(actorId)
                .actorRole(actorRole)
                .action(action)
                .targetId(targetId)
                .details(details)
                .timestamp(LocalDateTime.now())
                .build();
        auditLogRepository.save(auditLog);
        log.info("Audit: gymId={}, actorId={}, action={}, targetId={}", gymId, actorId, action, targetId);
    }

    public PagedResponse<AuditLog> getAuditLogs(String action, String actorId, Pageable pageable) {
        if (SecurityUtils.getCurrentRole() != null && !SecurityUtils.isOwner()) {
            throw new com.gymapp.common.exception.AppException(
                    com.gymapp.common.exception.ErrorCode.ACCESS_DENIED, "Access denied");
        }

        String gymId = TenantContext.getGymId();

        Query query = new Query().with(pageable);
        query.addCriteria(Criteria.where("gymId").is(gymId));

        if (StringUtils.hasText(action)) {
            query.addCriteria(Criteria.where("action").is(action));
        }

        if (StringUtils.hasText(actorId)) {
            query.addCriteria(Criteria.where("actorId").is(actorId));
        }

        long total = mongoTemplate.count(Query.of(query).limit(-1).skip(-1), AuditLog.class);
        List<AuditLog> list = mongoTemplate.find(query, AuditLog.class);
        Page<AuditLog> page = new PageImpl<>(list, pageable, total);

        return PagedResponse.<AuditLog>builder()
                .content(page.getContent())
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }
}
