package com.gymapp.integration;

import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MongoDBContainer;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
public abstract class AbstractIntegrationTest {

    static final MongoDBContainer mongoDBContainer = new MongoDBContainer("mongo:7").withExposedPorts(27017);

    static {
        mongoDBContainer.start();
    }

    @DynamicPropertySource
    static void setProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", mongoDBContainer::getReplicaSetUrl);
        registry.add("app.jwt.secret", () -> "supersecretkeythatisverylongandsecure32bytes");
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    protected com.gymapp.security.LoginRateLimiter loginRateLimiter;

    @org.junit.jupiter.api.BeforeEach
    void resetRateLimiter() {
        if (loginRateLimiter != null) {
            loginRateLimiter.reset();
        }
    }
}
