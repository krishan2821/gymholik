package com.gymapp.common.exception;

import lombok.Getter;

import java.util.Collections;
import java.util.Map;

/**
 * Domain exception carrying a typed {@link ErrorCode}.
 * Controllers and services throw this; the global handler translates it
 * into a standardised {@link com.gymapp.common.ApiResponse}.
 */
@Getter
public class AppException extends RuntimeException {

    private final ErrorCode errorCode;
    private final Long retryAfterSeconds;
    private final Map<String, String> fieldErrors;

    /** Use the ErrorCode's built-in message. */
    public AppException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode;
        this.retryAfterSeconds = null;
        this.fieldErrors = Collections.emptyMap();
    }

    /** Override the default message with a more specific one. */
    public AppException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
        this.retryAfterSeconds = null;
        this.fieldErrors = Collections.emptyMap();
    }

    /** Construct a rate-limit or retryable exception with retryAfterSeconds. */
    public AppException(ErrorCode errorCode, String message, long retryAfterSeconds) {
        super(message);
        this.errorCode = errorCode;
        this.retryAfterSeconds = retryAfterSeconds;
        this.fieldErrors = Collections.emptyMap();
    }

    /** Construct an exception with field-level errors. */
    public AppException(ErrorCode errorCode, String message, Map<String, String> fieldErrors) {
        super(message);
        this.errorCode = errorCode;
        this.retryAfterSeconds = null;
        this.fieldErrors = fieldErrors != null ? Collections.unmodifiableMap(fieldErrors) : Collections.emptyMap();
    }
}
