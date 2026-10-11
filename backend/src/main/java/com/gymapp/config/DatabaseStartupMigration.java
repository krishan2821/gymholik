package com.gymapp.config;

import com.gymapp.module.auth.dto.SendOtpRequest;
import com.gymapp.module.auth.entity.Gym;
import com.gymapp.module.auth.entity.User;
import com.gymapp.module.auth.repository.GymRepository;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.module.auth.service.GymCodeGenerator;
import com.mongodb.client.result.UpdateResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Idempotent startup migration and SUPER_ADMIN seeder.
 *
 * 1. Drops legacy password/lockout fields (passwordHash, failedAttempts, lockedUntil, mustChangePassword)
 *    from existing documents in the 'users' collection.
 * 2. Converts users with status PENDING_APPROVAL or REJECTED to INACTIVE (and active = false).
 * 3. Renames 'receiptPrefix' to 'gymCode' on existing documents in the 'gyms' collection and generates gymCodes for gyms without one.
 * 4. Logs the number of modified documents for each step.
 * 5. Seeds a single SUPER_ADMIN user from SUPER_ADMIN_PHONE if none exists.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DatabaseStartupMigration implements ApplicationRunner {

    private static final Pattern INDIAN_PHONE_PATTERN = Pattern.compile("^[6-9]\\d{9}$");

    private final MongoTemplate mongoTemplate;
    private final UserRepository userRepository;
    private final GymRepository gymRepository;
    private final GymCodeGenerator gymCodeGenerator;
    private final Environment environment;

    @Value("${app.super-admin.phone:}")
    private String superAdminPhone;

    public record MigrationResult(
            long usersLegacyFieldsDropped,
            long usersStatusConverted,
            long gymsRenamed,
            long gymCodesGenerated
    ) {}

    @Override
    public void run(ApplicationArguments args) {
        runMigration();
        String configuredPhone = resolveSuperAdminPhone();
        seedSuperAdminIfNeeded(configuredPhone);
    }

    /**
     * Executes the idempotent MongoDB schema migration and logs how many documents changed.
     */
    public MigrationResult runMigration() {
        // 1. Drop removed fields from existing users
        Query unsetFieldsQuery = new Query(new Criteria().orOperator(
                Criteria.where("passwordHash").exists(true),
                Criteria.where("failedAttempts").exists(true),
                Criteria.where("lockedUntil").exists(true),
                Criteria.where("mustChangePassword").exists(true)
        ));
        Update unsetFieldsUpdate = new Update()
                .unset("passwordHash")
                .unset("failedAttempts")
                .unset("lockedUntil")
                .unset("mustChangePassword");
        UpdateResult unsetResult = mongoTemplate.updateMulti(unsetFieldsQuery, unsetFieldsUpdate, "users");
        long usersFieldsDropped = unsetResult.getModifiedCount();

        // 2. Convert PENDING_APPROVAL and REJECTED users to INACTIVE
        Query statusQuery = new Query(Criteria.where("status").in(List.of("PENDING_APPROVAL", "REJECTED")));
        Update statusUpdate = new Update()
                .set("status", "INACTIVE")
                .set("active", false);
        UpdateResult statusResult = mongoTemplate.updateMulti(statusQuery, statusUpdate, "users");
        long usersStatusConverted = statusResult.getModifiedCount();

        // 3. Rename receiptPrefix -> gymCode in gyms collection
        Query renameQuery = new Query(new Criteria().andOperator(
                Criteria.where("receiptPrefix").exists(true),
                Criteria.where("gymCode").exists(false)
        ));
        Update renameUpdate = new Update().rename("receiptPrefix", "gymCode");
        UpdateResult renameResult = mongoTemplate.updateMulti(renameQuery, renameUpdate, "gyms");

        Query cleanupQuery = new Query(Criteria.where("receiptPrefix").exists(true));
        Update cleanupUpdate = new Update().unset("receiptPrefix");
        UpdateResult cleanupResult = mongoTemplate.updateMulti(cleanupQuery, cleanupUpdate, "gyms");
        long gymsRenamed = renameResult.getModifiedCount() + cleanupResult.getModifiedCount();

        try {
            mongoTemplate.indexOps("gyms").dropIndex("receiptPrefix");
        } catch (Exception ignored) {
            // Index may not exist or may already be dropped
        }
        try {
            mongoTemplate.indexOps("gyms").dropIndex("receiptPrefix_1");
        } catch (Exception ignored) {
            // Index may not exist or may already be dropped
        }

        // Set gymType to null for existing gyms where gymType does not exist
        Query gymTypeQuery = new Query(Criteria.where("gymType").exists(false));
        Update gymTypeUpdate = new Update().set("gymType", null);
        mongoTemplate.updateMulti(gymTypeQuery, gymTypeUpdate, "gyms");

        // Generate gymCode for gyms without one
        List<Gym> gymsWithoutCode = gymRepository.findByGymCodeIsNull();
        long gymCodesGenerated = 0;
        for (Gym gym : gymsWithoutCode) {
            String code = generateUniqueGymCode();
            mongoTemplate.updateFirst(
                    new Query(Criteria.where("_id").is(gym.getId())),
                    new Update().set("gymCode", code),
                    "gyms"
            );
            gymCodesGenerated++;
        }

        log.info("Startup migration completed: usersLegacyFieldsDropped={}, usersStatusConvertedToInactive={}, gymsReceiptPrefixRenamedToGymCode={}, gymCodesGenerated={}",
                usersFieldsDropped, usersStatusConverted, gymsRenamed, gymCodesGenerated);

        return new MigrationResult(usersFieldsDropped, usersStatusConverted, gymsRenamed, gymCodesGenerated);
    }

    private String generateUniqueGymCode() {
        for (int i = 0; i < 5; i++) {
            String code = gymCodeGenerator.generate();
            if (!gymRepository.existsByGymCode(code)) {
                return code;
            }
        }
        throw new IllegalStateException("Failed to generate unique gymCode during startup migration");
    }

    /**
     * Seeds one SUPER_ADMIN user from SUPER_ADMIN_PHONE if no SUPER_ADMIN exists yet.
     * Never logs the phone number.
     */
    public boolean seedSuperAdminIfNeeded(String rawPhone) {
        if (userRepository.existsByRole("SUPER_ADMIN")) {
            return false;
        }
        String normalized = SendOtpRequest.normalizePhone(rawPhone);
        if (!StringUtils.hasText(normalized)) {
            return false;
        }
        if (!INDIAN_PHONE_PATTERN.matcher(normalized).matches()) {
            log.warn("SUPER_ADMIN_PHONE is not a valid 10-digit Indian mobile number; skipping SUPER_ADMIN seed.");
            return false;
        }
        if (userRepository.existsByPhone(normalized)) {
            log.warn("Cannot seed SUPER_ADMIN because a user with the configured phone already exists.");
            return false;
        }

        User superAdmin = User.builder()
                .name("Super Admin")
                .phone(normalized)
                .role("SUPER_ADMIN")
                .active(true)
                .status("ACTIVE")
                .gymId(null)
                .tokenVersion(0)
                .build();
        userRepository.save(superAdmin);
        log.info("Seeded initial SUPER_ADMIN account");
        return true;
    }

    private String resolveSuperAdminPhone() {
        if (StringUtils.hasText(superAdminPhone)) {
            return superAdminPhone;
        }
        if (environment != null) {
            String fromProp = environment.getProperty("app.super-admin.phone");
            if (StringUtils.hasText(fromProp)) {
                return fromProp;
            }
            String fromEnv = environment.getProperty("SUPER_ADMIN_PHONE");
            if (StringUtils.hasText(fromEnv)) {
                return fromEnv;
            }
        }
        return "";
    }
}
