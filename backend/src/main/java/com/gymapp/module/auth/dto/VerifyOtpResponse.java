package com.gymapp.module.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class VerifyOtpResponse {

    @JsonProperty("isNewUser")
    private boolean isNewUser;

    private String accessToken;

    private String refreshToken;

    private UserSummary user;

    private GymSummary gym;

    private String registrationToken;

    @JsonProperty("isNewUser")
    public boolean isNewUser() {
        return isNewUser;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public static class UserSummary {
        private String id;
        private String name;
        private String role;
        private String gymId;
        private String gymName;
    }

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class GymSummary {
        private String id;
        private String name;
        private String gymCode;
        private String gymType;
    }
}
