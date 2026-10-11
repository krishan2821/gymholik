package com.gymapp.module.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendOtpResponse {
    private long resendAfterSeconds;
    private long expiresInSeconds;
}
