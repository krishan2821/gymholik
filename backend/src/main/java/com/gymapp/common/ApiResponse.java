package com.gymapp.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

/**
 * Uniform API envelope for every response.
 * Fields with null values are omitted from JSON to keep payloads lean.
 */
@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final boolean success;
    private final String message;
    private final T data;
    private final Object error;
    private final Long retryAfterSeconds;

    public Object getErrorCode() {
        return error;
    }

    public Object getCode() {
        if (error instanceof String) {
            return error;
        }
        if (error instanceof java.util.Map<?, ?> m && m.containsKey("code")) {
            return m.get("code");
        }
        return null;
    }

    // ── Factory helpers ──────────────────────────────────────────────────────

    public static <T> ApiResponse<T> success(String message, T data) {
        return ApiResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .build();
    }

    public static <T> ApiResponse<T> success(String message) {
        return ApiResponse.<T>builder()
                .success(true)
                .message(message)
                .build();
    }

    public static <T> ApiResponse<T> error(String message, Object error) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(message)
                .error(error)
                .build();
    }

    public static <T> ApiResponse<T> error(String message, Object error, Long retryAfterSeconds, T data) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(message)
                .error(error)
                .retryAfterSeconds(retryAfterSeconds)
                .data(data)
                .build();
    }
}
