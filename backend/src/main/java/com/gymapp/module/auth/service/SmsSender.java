package com.gymapp.module.auth.service;

import java.util.Optional;

/**
 * Abstraction for sending OTPs via SMS.
 *
 * Implementations:
 *  - {@link LogSmsSender}: dev profile only — logs the OTP to the console.
 *  - {@link DevFixedOtp}: dev profile only when {@code app.otp.dev-fixed-code} is set —
 *    forces every OTP to that fixed code and sends no SMS.
 *
 * TODO: Add Msg91SmsSender (@Profile("prod")) implementation using the
 *       app.sms.msg91.{auth-key, template-id, sender-id, base-url} properties in application.yml.
 */
public interface SmsSender {

    /**
     * Sends the generated 6-digit OTP to the given normalized 10-digit Indian mobile number.
     * Implementations MUST NOT log the phone number.
     */
    void sendOtp(String phone, String otp);

    /**
     * Optional fixed OTP override (used only by {@link DevFixedOtp} in dev mode).
     */
    default Optional<String> getFixedOtp() {
        return Optional.empty();
    }
}
