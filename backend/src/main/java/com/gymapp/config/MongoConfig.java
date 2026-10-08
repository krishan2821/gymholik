package com.gymapp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;

/**
 * MongoDB configuration.
 * - Auditing: populates @CreatedDate / @LastModifiedDate automatically.
 * - Transaction manager: enables @Transactional support on replica sets.
 */
@Configuration
@EnableMongoAuditing
@EnableMongoRepositories(basePackages = "com.gymapp")
public class MongoConfig {

    @Bean
    public MongoTransactionManager transactionManager(MongoDatabaseFactory dbFactory) {
        return new MongoTransactionManager(dbFactory);
    }
}
