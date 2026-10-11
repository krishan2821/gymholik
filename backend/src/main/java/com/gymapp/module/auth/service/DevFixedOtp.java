package com.gymapp.module.auth.service;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.Optional;

/**
 * Dev-only fixed OTP implementation active when {@code app.otp.dev-fixed-code} is set.
 * Every OTP equals the configured code (e.g. 123456) and no SMS is sent.
 *
 * Refuses to start if the {@code prod} profile is active.
 */
@Component
@Primary
@ConditionalOnExpression("T(org.springframework.util.StringUtils).hasText('${app.otp.dev-fixed-code:}')")
public class DevFixedOtp implements SmsSender, InitializingBean {

    private final String fixedCode;
    private final Environment environment;

    public DevFixedOtp(
            @Value("${app.otp.dev-fixed-code:}") String fixedCode,
            Environment environment) {
        this.fixedCode = fixedCode != null ? fixedCode.trim() : "";
        this.environment = environment;
        validateEnvironment();
    }

    @Override
    public void afterPropertiesSet() {
        validateEnvironment();
    }

    @PostConstruct
    public void validateEnvironment() {
        if (!StringUtils.hasText(fixedCode)) {
            return;
        }
        boolean isProd = environment != null && (
                environment.acceptsProfiles(Profiles.of("prod", "production"))
                || Arrays.asList(environment.getProperty("spring.profiles.active", "").split(","))
                        .stream().map(String::trim)
                        .anyMatch(p -> "prod".equalsIgnoreCase(p) || "production".equalsIgnoreCase(p)));

        if (isProd) {
            throw new IllegalStateException(
                    "CRITICAL: Property 'app.otp.dev-fixed-code' must not be set when the 'prod' profile is active!");
        }
        if (environment != null && !environment.acceptsProfiles(Profiles.of("(dev | test) & !prod & !production"))) {
            throw new IllegalStateException(
                    "Property 'app.otp.dev-fixed-code' is only allowed under 'dev' (or 'test') profile.");
        }
        if (!fixedCode.matches("^\\d{6}$")) {
            throw new IllegalStateException(
                    "Property 'app.otp.dev-fixed-code' must be a 6-digit numeric code.");
        }
    }

    @Override
    public void sendOtp(String phone, String otp) {
        // No-op: no SMS is sent and nothing is logged when dev-fixed-code is active.
    }

    @Override
    public Optional<String> getFixedOtp() {
        return Optional.of(fixedCode);
    }
}
