package com.gymapp.common.exception;

import com.gymapp.common.ApiResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** Handles all intentional domain errors (wrong credentials, locked, not found, etc.). */
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Object>> handleAppException(AppException ex) {
        log.warn("Domain error [{}]: {}", ex.getErrorCode(), ex.getMessage());
        if (ex.getRetryAfterSeconds() != null) {
            return ResponseEntity
                    .status(ex.getErrorCode().getHttpStatus())
                    .header("Retry-After", String.valueOf(ex.getRetryAfterSeconds()))
                    .body(ApiResponse.error(
                            ex.getMessage(),
                            ex.getErrorCode().name(),
                            ex.getRetryAfterSeconds(),
                            Map.of("retryAfterSeconds", ex.getRetryAfterSeconds())));
        }
        if (ex.getFieldErrors() != null && !ex.getFieldErrors().isEmpty()) {
            Map<String, Object> errorMap = new LinkedHashMap<>();
            errorMap.put("code", ex.getErrorCode().name());
            errorMap.put("fields", ex.getFieldErrors());
            errorMap.putAll(ex.getFieldErrors());
            return ResponseEntity
                    .status(ex.getErrorCode().getHttpStatus())
                    .body(ApiResponse.error(ex.getMessage(), errorMap));
        }
        return ResponseEntity
                    .status(ex.getErrorCode().getHttpStatus())
                    .body(ApiResponse.error(ex.getMessage(), ex.getErrorCode().name()));
    }

    /** Converts Bean Validation errors into a field → message map. */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getAllErrors().forEach(err -> {
            String field = ((FieldError) err).getField();
            fieldErrors.put(field, err.getDefaultMessage());
        });
        Map<String, Object> errorMap = new LinkedHashMap<>();
        errorMap.put("code", ErrorCode.VALIDATION_ERROR.name());
        errorMap.put("fields", fieldErrors);
        errorMap.putAll(fieldErrors);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(ErrorCode.VALIDATION_ERROR.getDefaultMessage(), errorMap));
    }

    /**
     * Spring Security throws AccessDeniedException for @PreAuthorize failures.
     * We must handle it here (not in the filter) to return our ApiResponse shape.
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("Access denied", ErrorCode.ACCESS_DENIED.name()));
    }

    /** Handles duplicate key violations from MongoDB indexes without logging PII key values. */
    @ExceptionHandler(org.springframework.dao.DuplicateKeyException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicateKey(org.springframework.dao.DuplicateKeyException ex) {
        log.warn("Duplicate key collision on unique index");
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(ApiResponse.error("Duplicate key collision: resource already exists", "DUPLICATE_KEY"));
    }

    /** Safety net for anything unhandled – logs full stack trace. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneric(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(ErrorCode.INTERNAL_ERROR.getDefaultMessage(), null));
    }
}
