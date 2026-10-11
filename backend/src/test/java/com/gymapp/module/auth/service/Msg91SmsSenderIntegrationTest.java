package com.gymapp.module.auth.service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import com.gymapp.module.auth.repository.GymRepository;
import com.gymapp.module.auth.repository.OtpRequestRepository;
import com.gymapp.module.auth.repository.RefreshTokenRepository;
import com.gymapp.module.auth.repository.UserRepository;
import com.gymapp.security.JwtUtil;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class Msg91SmsSenderIntegrationTest {

    private static final String TEST_AUTH_KEY = "test_msg91_auth_key_12345";
    private static final String TEST_TEMPLATE_ID = "DLT_TMPL_987654";
    private static final String TEST_SENDER_ID = "GYMHLK";
    private static final String TEST_ENTITY_ID = "DLT_ENT_112233";

    private HttpServer mockServer;
    private int mockServerPort;
    private String mockServerBaseUrl;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private ListAppender<ILoggingEvent> logWatcher;
    private Logger logger;

    private java.util.concurrent.ExecutorService serverExecutor;

    @BeforeEach
    void setUp() throws IOException {
        mockServer = HttpServer.create(new InetSocketAddress(0), 0);
        serverExecutor = java.util.concurrent.Executors.newCachedThreadPool();
        mockServer.setExecutor(serverExecutor);
        mockServerPort = mockServer.getAddress().getPort();
        mockServerBaseUrl = "http://localhost:" + mockServerPort + "/api/v5/otp";
        mockServer.start();

        logger = (Logger) LoggerFactory.getLogger(Msg91SmsSender.class);
        logWatcher = new ListAppender<>();
        logWatcher.start();
        logger.addAppender(logWatcher);
    }

    @AfterEach
    void tearDown() {
        if (mockServer != null) {
            mockServer.stop(0);
        }
        if (serverExecutor != null) {
            serverExecutor.shutdownNow();
        }
        if (logger != null && logWatcher != null) {
            logger.detachAppender(logWatcher);
        }
    }

    private Msg91SmsSender createSender(int connectTimeoutMs, int readTimeoutMs) {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("app.sms.provider", "msg91");

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);
        RestTemplate restTemplate = new RestTemplate(factory);

        return new Msg91SmsSender(
                TEST_AUTH_KEY,
                TEST_TEMPLATE_ID,
                TEST_SENDER_ID,
                TEST_ENTITY_ID,
                mockServerBaseUrl,
                restTemplate,
                env,
                objectMapper);
    }

    @Test
    @DisplayName("Successfully sends OTP with valid DLT parameters and headers")
    void sendsOtpSuccessfully() {
        List<String> receivedAuthKeys = Collections.synchronizedList(new ArrayList<>());
        List<String> receivedBodies = Collections.synchronizedList(new ArrayList<>());

        mockServer.createContext("/api/v5/otp", exchange -> {
            receivedAuthKeys.add(exchange.getRequestHeaders().getFirst("authkey"));
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            receivedBodies.add(body);

            byte[] response = "{\"type\":\"success\",\"message\":\"OTP sent successfully\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response);
            }
        });

        Msg91SmsSender sender = createSender(5000, 5000);
        sender.sendOtp("9876543210", "456789");

        assertThat(receivedAuthKeys).containsExactly(TEST_AUTH_KEY);
        assertThat(receivedBodies).hasSize(1);

        try {
            JsonNode payload = objectMapper.readTree(receivedBodies.get(0));
            assertThat(payload.path("template_id").asText()).isEqualTo(TEST_TEMPLATE_ID);
            assertThat(payload.path("mobile").asText()).isEqualTo("919876543210");
            assertThat(payload.path("otp").asText()).isEqualTo("456789");
            assertThat(payload.path("sender").asText()).isEqualTo(TEST_SENDER_ID);
            assertThat(payload.path("DLT_TE_ID").asText()).isEqualTo(TEST_TEMPLATE_ID);
            assertThat(payload.path("DLT_PE_ID").asText()).isEqualTo(TEST_ENTITY_ID);
            assertThat(payload.path("message").asText())
                    .isEqualTo("Your Gymholik OTP is 456789. Valid for 5 minutes. Do not share this code with anyone. - GYMHLK");
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        // Verify logs NEVER contain OTP or phone number
        for (ILoggingEvent event : logWatcher.list) {
            assertThat(event.getFormattedMessage()).doesNotContain("9876543210");
            assertThat(event.getFormattedMessage()).doesNotContain("456789");
        }
    }

    @Test
    @DisplayName("Retries once on network failure / connection drop and succeeds on 2nd attempt")
    void retriesOnceOnNetworkFailureAndSucceeds() {
        AtomicInteger requestCounter = new AtomicInteger(0);

        mockServer.createContext("/api/v5/otp", exchange -> {
            int current = requestCounter.incrementAndGet();
            if (current == 1) {
                // Abruptly terminate connection on first attempt to simulate network drop
                exchange.close();
            } else {
                byte[] response = "{\"type\":\"success\",\"message\":\"OTP sent successfully\"}".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, response.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(response);
                }
            }
        });

        Msg91SmsSender sender = createSender(2000, 2000);
        sender.sendOtp("9123456789", "112233");

        assertThat(requestCounter.get()).isEqualTo(2);

        // Verify logs do not leak sensitive values
        for (ILoggingEvent event : logWatcher.list) {
            assertThat(event.getFormattedMessage()).doesNotContain("9123456789");
            assertThat(event.getFormattedMessage()).doesNotContain("112233");
        }
    }

    @Test
    @DisplayName("Fails after 2 network failures and throws generic SMS_SEND_FAILED error")
    void failsAfterExhaustingRetriesOnNetworkFailure() {
        AtomicInteger requestCounter = new AtomicInteger(0);

        mockServer.createContext("/api/v5/otp", HttpExchange::close);

        Msg91SmsSender sender = createSender(1000, 1000);

        assertThatThrownBy(() -> sender.sendOtp("9988776655", "998877"))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException appEx = (AppException) ex;
                    assertThat(appEx.getErrorCode()).isEqualTo(ErrorCode.SMS_SEND_FAILED);
                    assertThat(appEx.getMessage()).isEqualTo("Failed to send SMS. Please try again.");
                });

        // Verify logs do not contain phone number or OTP
        for (ILoggingEvent event : logWatcher.list) {
            assertThat(event.getFormattedMessage()).doesNotContain("9988776655");
            assertThat(event.getFormattedMessage()).doesNotContain("998877");
        }
    }

    @Test
    @DisplayName("Handles read timeout, retries once, and falls back to generic error")
    void handlesTimeoutAndFallsBackToGenericError() {
        AtomicInteger requestCounter = new AtomicInteger(0);

        mockServer.createContext("/api/v5/otp", exchange -> {
            requestCounter.incrementAndGet();
            try {
                // Sleep longer than read timeout (150ms)
                Thread.sleep(300);
            } catch (InterruptedException ignored) {
            }
            byte[] response = "{\"type\":\"success\"}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, response.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response);
            }
        });

        // 100ms read timeout triggers SocketTimeoutException
        Msg91SmsSender sender = createSender(500, 100);

        assertThatThrownBy(() -> sender.sendOtp("9876501234", "765432"))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException appEx = (AppException) ex;
                    assertThat(appEx.getErrorCode()).isEqualTo(ErrorCode.SMS_SEND_FAILED);
                });

        assertThat(requestCounter.get()).isEqualTo(2);

        for (ILoggingEvent event : logWatcher.list) {
            assertThat(event.getFormattedMessage()).doesNotContain("9876501234");
            assertThat(event.getFormattedMessage()).doesNotContain("765432");
        }
    }

    @Test
    @DisplayName("Handles HTTP 4xx provider error and falls back to generic error without retry")
    void handlesProviderHttpErrorWithoutRetry() {
        AtomicInteger requestCounter = new AtomicInteger(0);

        mockServer.createContext("/api/v5/otp", exchange -> {
            requestCounter.incrementAndGet();
            byte[] response = "{\"type\":\"error\",\"message\":\"Authentication failed\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(401, response.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response);
            }
        });

        Msg91SmsSender sender = createSender(2000, 2000);

        assertThatThrownBy(() -> sender.sendOtp("9876512345", "654321"))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException appEx = (AppException) ex;
                    assertThat(appEx.getErrorCode()).isEqualTo(ErrorCode.SMS_SEND_FAILED);
                });

        // Should not retry non-network HTTP errors
        assertThat(requestCounter.get()).isEqualTo(1);

        for (ILoggingEvent event : logWatcher.list) {
            assertThat(event.getFormattedMessage()).doesNotContain("9876512345");
            assertThat(event.getFormattedMessage()).doesNotContain("654321");
        }
    }

    @Test
    @DisplayName("Handles HTTP 200 with error payload and falls back to generic error")
    void handlesProvider200WithErrorPayload() {
        AtomicInteger requestCounter = new AtomicInteger(0);

        mockServer.createContext("/api/v5/otp", exchange -> {
            requestCounter.incrementAndGet();
            byte[] response = "{\"type\":\"error\",\"message\":\"Invalid template\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response);
            }
        });

        Msg91SmsSender sender = createSender(2000, 2000);

        assertThatThrownBy(() -> sender.sendOtp("9876512345", "123123"))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> {
                    AppException appEx = (AppException) ex;
                    assertThat(appEx.getErrorCode()).isEqualTo(ErrorCode.SMS_SEND_FAILED);
                });

        assertThat(requestCounter.get()).isEqualTo(1);

        for (ILoggingEvent event : logWatcher.list) {
            assertThat(event.getFormattedMessage()).doesNotContain("9876512345");
            assertThat(event.getFormattedMessage()).doesNotContain("123123");
        }
    }

    // ── Production Profile Startup Validation Tests ─────────────────────────────

    @org.springframework.context.annotation.Configuration
    @org.springframework.context.annotation.Import({OtpService.class, Msg91SmsSender.class, LogSmsSender.class})
    static class TestContextConfig {
    }

    private ApplicationContextRunner createContextRunner() {
        return new ApplicationContextRunner()
                .withUserConfiguration(TestContextConfig.class)
                .withBean(OtpRequestRepository.class, () -> mock(OtpRequestRepository.class))
                .withBean(UserRepository.class, () -> mock(UserRepository.class))
                .withBean(GymRepository.class, () -> mock(GymRepository.class))
                .withBean(RefreshTokenRepository.class, () -> mock(RefreshTokenRepository.class))
                .withBean(JwtUtil.class, () -> mock(JwtUtil.class))
                .withBean(ObjectMapper.class, ObjectMapper::new);
    }

    @Test
    @DisplayName("Fails startup in prod profile when app.sms.provider is missing or set to log")
    void failsStartupInProdWhenProviderIsNotMsg91() {
        createContextRunner()
                .withPropertyValues(
                        "spring.profiles.active=prod",
                        "app.otp.pepper=super-secure-production-pepper-32chars",
                        "app.sms.provider=log"
                )
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseInstanceOf(IllegalStateException.class)
                            .hasStackTraceContaining("app.sms.provider");
                });
    }

    @Test
    @DisplayName("Fails startup in prod profile when MSG91 credentials are missing")
    void failsStartupInProdWhenCredentialsMissing() {
        createContextRunner()
                .withPropertyValues(
                        "spring.profiles.active=prod",
                        "app.otp.pepper=super-secure-production-pepper-32chars",
                        "app.sms.provider=msg91"
                        // Missing MSG91_AUTH_KEY, MSG91_TEMPLATE_ID, etc.
                )
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseInstanceOf(IllegalStateException.class)
                            .hasStackTraceContaining("MSG91");
                });
    }

    @Test
    @DisplayName("Fails startup in prod profile when dev fixed OTP is enabled")
    void failsStartupInProdWhenDevFixedOtpEnabled() {
        createContextRunner()
                .withPropertyValues(
                        "spring.profiles.active=prod",
                        "app.otp.pepper=super-secure-production-pepper-32chars",
                        "app.sms.provider=msg91",
                        "app.sms.msg91.auth-key=key123",
                        "app.sms.msg91.template-id=tmpl123",
                        "app.sms.msg91.sender-id=GYMHLK",
                        "app.sms.msg91.entity-id=ent123",
                        "app.otp.dev-fixed-code=123456"
                )
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasRootCauseInstanceOf(IllegalStateException.class)
                            .hasStackTraceContaining("app.otp.dev-fixed-code");
                });
    }

    @Test
    @DisplayName("Starts up successfully in prod profile when provider=msg91 and all credentials configured")
    void startsSuccessfullyInProdWhenProperlyConfigured() {
        createContextRunner()
                .withPropertyValues(
                        "spring.profiles.active=prod",
                        "app.otp.pepper=super-secure-production-pepper-32chars",
                        "app.sms.provider=msg91",
                        "app.sms.msg91.auth-key=key123",
                        "app.sms.msg91.template-id=tmpl123",
                        "app.sms.msg91.sender-id=GYMHLK",
                        "app.sms.msg91.entity-id=ent123"
                )
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(Msg91SmsSender.class);
                    assertThat(context).hasSingleBean(OtpService.class);
                });
    }
}
