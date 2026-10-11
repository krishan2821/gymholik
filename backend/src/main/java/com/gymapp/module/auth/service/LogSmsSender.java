package com.gymapp.module.auth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * Dev-only SMS sender that logs the generated OTP to the console.
 * Never logs phone numbers.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.sms.provider", havingValue = "log", matchIfMissing = true)
@Profile({"dev & !prod & !production", "test & !prod & !production"})
@ConditionalOnExpression("!T(org.springframework.util.StringUtils).hasText('${app.otp.dev-fixed-code:}')")
@RequiredArgsConstructor
public class LogSmsSender implements SmsSender {

    private final Environment environment;

    @Override
    public void sendOtp(String phone, String otp) {
        if (environment != null && environment.acceptsProfiles(Profiles.of("dev & !prod & !production"))) {
            log.info("[DEV OTP] Generated OTP code: {}", otp);
        }
    }
}
