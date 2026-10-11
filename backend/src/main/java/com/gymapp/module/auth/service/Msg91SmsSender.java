package com.gymapp.module.auth.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gymapp.common.exception.AppException;
import com.gymapp.common.exception.ErrorCode;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/**
 * Real SMS provider implementation of {@link SmsSender} using the MSG91 OTP API.
 * Activated by setting {@code app.sms.provider=msg91}.
 *
 * Security & Reliability:
 *  - Reads auth key, sender ID, DLT template ID, and entity ID from environment variables / config.
 *  - Uses approved DLT template text.
 *  - Handles provider errors and timeouts.
 *  - Never logs the OTP or the recipient phone number.
 *  - Retries once on network failure.
 *  - Falls back to returning a generic error.
 *  - Fails startup in 'prod' profile if required properties are not configured.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.sms.provider", havingValue = "msg91")
public class Msg91SmsSender implements SmsSender, InitializingBean {

    public static final String DLT_TEMPLATE_TEXT =
            "Your Gymholik OTP is %s. Valid for 5 minutes. Do not share this code with anyone. - GYMHLK";

    private final String authKey;
    private final String templateId;
    private final String senderId;
    private final String entityId;
    private final String baseUrl;
    private final int connectTimeoutMs;
    private final int readTimeoutMs;
    private final Environment environment;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @org.springframework.beans.factory.annotation.Autowired
    public Msg91SmsSender(
            @Value("${app.sms.msg91.auth-key:}") String authKey,
            @Value("${app.sms.msg91.template-id:}") String templateId,
            @Value("${app.sms.msg91.sender-id:GYMHLK}") String senderId,
            @Value("${app.sms.msg91.entity-id:}") String entityId,
            @Value("${app.sms.msg91.base-url:https://control.msg91.com/api/v5/otp}") String baseUrl,
            @Value("${app.sms.msg91.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${app.sms.msg91.read-timeout-ms:5000}") int readTimeoutMs,
            Environment environment,
            ObjectMapper objectMapper) {
        this.environment = environment;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
        this.connectTimeoutMs = connectTimeoutMs > 0 ? connectTimeoutMs : 5000;
        this.readTimeoutMs = readTimeoutMs > 0 ? readTimeoutMs : 5000;

        this.authKey = resolveValue(authKey, "MSG91_AUTH_KEY");
        this.templateId = resolveValue(templateId, "MSG91_TEMPLATE_ID", "MSG91_DLT_TEMPLATE_ID");
        this.senderId = StringUtils.hasText(senderId) ? senderId.trim() : resolveValue("", "MSG91_SENDER_ID");
        this.entityId = resolveValue(entityId, "MSG91_ENTITY_ID", "MSG91_DLT_ENTITY_ID");
        this.baseUrl = StringUtils.hasText(baseUrl) ? baseUrl.trim() : "https://control.msg91.com/api/v5/otp";

        this.restTemplate = createRestTemplate(this.connectTimeoutMs, this.readTimeoutMs);
    }

    /**
     * Package-private constructor for testing with custom RestTemplate and configuration.
     */
    Msg91SmsSender(
            String authKey,
            String templateId,
            String senderId,
            String entityId,
            String baseUrl,
            RestTemplate restTemplate,
            Environment environment,
            ObjectMapper objectMapper) {
        this.authKey = authKey != null ? authKey.trim() : "";
        this.templateId = templateId != null ? templateId.trim() : "";
        this.senderId = senderId != null ? senderId.trim() : "";
        this.entityId = entityId != null ? entityId.trim() : "";
        this.baseUrl = baseUrl != null ? baseUrl.trim() : "";
        this.connectTimeoutMs = 5000;
        this.readTimeoutMs = 5000;
        this.restTemplate = restTemplate;
        this.environment = environment;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
    }

    private String resolveValue(String directVal, String... envKeys) {
        if (StringUtils.hasText(directVal)) {
            return directVal.trim();
        }
        if (environment != null) {
            for (String key : envKeys) {
                String val = environment.getProperty(key);
                if (StringUtils.hasText(val)) {
                    return val.trim();
                }
            }
        }
        return "";
    }

    protected RestTemplate createRestTemplate(int connectTimeout, int readTimeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        return new RestTemplate(factory);
    }

    @Override
    public void afterPropertiesSet() {
        validateConfiguration();
    }

    @PostConstruct
    public void validateConfiguration() {
        boolean isProd = environment != null && (
                environment.acceptsProfiles(Profiles.of("prod", "production"))
                || Arrays.stream(environment.getProperty("spring.profiles.active", "").split(","))
                        .map(String::trim)
                        .anyMatch(p -> "prod".equalsIgnoreCase(p) || "production".equalsIgnoreCase(p)));

        if (isProd) {
            if (!StringUtils.hasText(authKey)) {
                throw new IllegalStateException("CRITICAL: MSG91 auth key (MSG91_AUTH_KEY) is missing in prod profile!");
            }
            if (!StringUtils.hasText(templateId)) {
                throw new IllegalStateException("CRITICAL: MSG91 DLT template ID (MSG91_TEMPLATE_ID) is missing in prod profile!");
            }
            if (!StringUtils.hasText(senderId)) {
                throw new IllegalStateException("CRITICAL: MSG91 sender ID (MSG91_SENDER_ID) is missing in prod profile!");
            }
            if (!StringUtils.hasText(entityId)) {
                throw new IllegalStateException("CRITICAL: MSG91 entity ID (MSG91_ENTITY_ID) is missing in prod profile!");
            }
        }
    }

    @Override
    public void sendOtp(String phone, String otp) {
        String formattedMobile = formatIndianMobile(phone);
        int maxAttempts = 2; // Initial try + 1 retry on network failure

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                log.info("[MSG91] Sending OTP via MSG91 API (attempt {}/{})", attempt, maxAttempts);
                sendRequest(formattedMobile, otp);
                log.info("[MSG91] OTP sent successfully via provider");
                return;
            } catch (ResourceAccessException e) {
                log.warn("[MSG91] Network failure sending SMS (attempt {}/{}): {}", attempt, maxAttempts, e.getClass().getSimpleName());
                if (attempt >= maxAttempts) {
                    log.error("[MSG91] SMS failed after {} network attempts. Falling back to generic error.", maxAttempts);
                    throw new AppException(ErrorCode.SMS_SEND_FAILED, "Failed to send SMS. Please try again.");
                }
            } catch (HttpStatusCodeException e) {
                log.error("[MSG91] SMS provider returned HTTP error status: {}", e.getStatusCode());
                throw new AppException(ErrorCode.SMS_SEND_FAILED, "Failed to send SMS. Please try again.");
            } catch (AppException e) {
                throw e;
            } catch (Exception e) {
                log.error("[MSG91] Unexpected failure during SMS send: {}", e.getClass().getSimpleName());
                throw new AppException(ErrorCode.SMS_SEND_FAILED, "Failed to send SMS. Please try again.");
            }
        }
    }

    private void sendRequest(String mobile, String otp) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (StringUtils.hasText(authKey)) {
            headers.set("authkey", authKey);
        }

        Map<String, Object> body = new HashMap<>();
        body.put("template_id", templateId);
        body.put("mobile", mobile);
        body.put("otp", otp);
        if (StringUtils.hasText(senderId)) {
            body.put("sender", senderId);
        }
        if (StringUtils.hasText(templateId)) {
            body.put("DLT_TE_ID", templateId);
        }
        if (StringUtils.hasText(entityId)) {
            body.put("DLT_PE_ID", entityId);
        }
        body.put("message", String.format(DLT_TEMPLATE_TEXT, otp));

        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(body, headers);

        ResponseEntity<String> response = restTemplate.postForEntity(baseUrl, requestEntity, String.class);

        if (!response.getStatusCode().is2xxSuccessful()) {
            log.error("[MSG91] SMS provider returned non-2xx status code: {}", response.getStatusCode());
            throw new AppException(ErrorCode.SMS_SEND_FAILED, "Failed to send SMS. Please try again.");
        }

        String responseBody = response.getBody();
        if (StringUtils.hasText(responseBody)) {
            try {
                JsonNode root = objectMapper.readTree(responseBody);
                if (root.has("type") && "error".equalsIgnoreCase(root.path("type").asText())) {
                    log.error("[MSG91] SMS provider returned error in payload response");
                    throw new AppException(ErrorCode.SMS_SEND_FAILED, "Failed to send SMS. Please try again.");
                }
            } catch (AppException e) {
                throw e;
            } catch (Exception e) {
                // Non-JSON or standard 2xx response
            }
        }
    }

    public static String formatIndianMobile(String phone) {
        if (!StringUtils.hasText(phone)) {
            return "";
        }
        String digits = phone.replaceAll("[^0-9]", "");
        if (digits.length() == 10) {
            return "91" + digits;
        }
        return digits;
    }

    public String getAuthKey() {
        return authKey;
    }

    public String getTemplateId() {
        return templateId;
    }

    public String getSenderId() {
        return senderId;
    }

    public String getEntityId() {
        return entityId;
    }

    public String getBaseUrl() {
        return baseUrl;
    }
}
