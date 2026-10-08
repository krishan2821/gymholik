package com.gymapp.common.exception;

import lombok.Getter;

/**
 * Domain exception carrying a typed {@link ErrorCode}.
 * Controllers and services throw this; the global handler translates it
 * into a standardised {@link com.gymapp.common.ApiResponse}.
 */
@Getter
public class AppException extends RuntimeException {

    private final ErrorCode errorCode;

    /** Use the ErrorCode's built-in message. */
    public AppException(ErrorCode errorCode) {
        super(errorCode.getDefaultMessage());
        this.errorCode = errorCode;
    }

    /** Override the default message with a more specific one. */
    public AppException(ErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}
