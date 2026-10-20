package com.gymapp.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.gymapp.module.member.service.MoneyRepairMigrationService;
import com.gymapp.module.payment.job.MoneyConsistencyNightlyJob;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.data.mongodb.uri=mongodb://localhost:27017/gymdb?replicaSet=rs0",
        "app.jobs.nightly-invariant-check=-"
})
public class LiveDatabaseRepairExecutionTest {

    @Autowired
    private MoneyRepairMigrationService moneyRepairMigrationService;

    @Autowired
    private MoneyConsistencyNightlyJob moneyConsistencyNightlyJob;

    @Test
    void executeLiveRepairAndVerifyZeroMismatches() throws Exception {
        ObjectMapper mapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        // 1. Run live repair (dryRun=false) exactly once
        MoneyRepairMigrationService.MoneyRepairReport liveReport = moneyRepairMigrationService.runRepair(false);
        assertNotNull(liveReport);
        System.out.println("=== LIVE_REPAIR_REPORT_START ===");
        System.out.println(mapper.writeValueAsString(liveReport));
        System.out.println("=== LIVE_REPAIR_REPORT_END ===");

        // 2. Immediately run dry run (dryRun=true); must report zero mismatches of every type
        MoneyRepairMigrationService.MoneyRepairReport postDryReport = moneyRepairMigrationService.runRepair(true);
        assertNotNull(postDryReport);
        System.out.println("=== POST_DRY_REPORT_START ===");
        System.out.println(mapper.writeValueAsString(postDryReport));
        System.out.println("=== POST_DRY_REPORT_END ===");

        // 3. Run nightly invariant check once
        MoneyConsistencyNightlyJob.InvariantReport invariantReport = moneyConsistencyNightlyJob.checkInvariants();
        assertNotNull(invariantReport);
        System.out.println("=== INVARIANT_REPORT_START ===");
        System.out.println(mapper.writeValueAsString(invariantReport));
        System.out.println("=== INVARIANT_REPORT_END ===");
        assertFalse(invariantReport.hasViolations(), "Expected 0 invariant violations after repair!");
    }
}
