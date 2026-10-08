package com.gymapp.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Catalogue of application-level errors.
 * Every error carries an HTTP status so the global handler doesn't
 * need a separate mapping table.
 */
@Getter
public enum ErrorCode {

    // ── Auth ──────────────────────────────────────────────────────────────────
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED,       "Invalid phone or password"),
    ACCOUNT_LOCKED(HttpStatus.TOO_MANY_REQUESTS,       "Account locked due to too many failed attempts. Try again later."),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED,             "Token has expired"),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED,             "Invalid or malformed token"),
    REFRESH_TOKEN_NOT_FOUND(HttpStatus.UNAUTHORIZED,   "Refresh token not found or has expired"),

    // ── User ──────────────────────────────────────────────────────────────────
    USER_NOT_FOUND(HttpStatus.NOT_FOUND,               "User not found"),
    USER_ALREADY_EXISTS(HttpStatus.CONFLICT,           "A user with this phone number already exists in this gym"),
    PHONE_ALREADY_EXISTS(HttpStatus.CONFLICT,          "Phone number is already registered"),

    // ── Gym ───────────────────────────────────────────────────────────────────
    GYM_NOT_FOUND(HttpStatus.NOT_FOUND,                "Gym not found"),
    GYM_SUSPENDED(HttpStatus.FORBIDDEN,                "This gym account has been suspended"),
    GYM_TRIAL_EXPIRED(HttpStatus.PAYMENT_REQUIRED,     "Trial period has expired. Please upgrade your plan."),
    SUBSCRIPTION_EXPIRED(HttpStatus.PAYMENT_REQUIRED,  "Gym SaaS subscription has expired"),

    // ── Authorization ─────────────────────────────────────────────────────────
    ACCESS_DENIED(HttpStatus.FORBIDDEN,                "Access denied"),

    // ── Plan ──────────────────────────────────────────────────────────────────
    PLAN_NOT_FOUND(HttpStatus.NOT_FOUND,               "Plan not found"),
    PLAN_NAME_EXISTS(HttpStatus.CONFLICT,              "A plan with this name already exists in this gym"),

    // ── Member ────────────────────────────────────────────────────────────────
    MEMBER_NOT_FOUND(HttpStatus.NOT_FOUND,             "Member not found"),
    MEMBER_PHONE_EXISTS(HttpStatus.CONFLICT,           "A member with this phone already exists in this gym"),
    MEMBER_INACTIVE(HttpStatus.UNPROCESSABLE_ENTITY,   "Operation not allowed on an inactive member"),

    // ── Membership ────────────────────────────────────────────────────────────
    MEMBERSHIP_NOT_FOUND(HttpStatus.NOT_FOUND,         "No membership found for this member"),

    // ── File ──────────────────────────────────────────────────────────────────
    INVALID_FILE_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Only image files (JPEG, PNG, WebP) are accepted"),
    FILE_PROCESSING_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to process the uploaded file"),

    // ── Trainer & Assignment ───────────────────────────────────────────────────
    TRAINER_PENDING_APPROVAL(HttpStatus.FORBIDDEN,     "Your trainer account is pending approval by the gym owner"),
    TRAINER_NOT_FOUND(HttpStatus.NOT_FOUND,            "Trainer not found"),
    TRAINER_INACTIVE(HttpStatus.UNPROCESSABLE_ENTITY,  "Trainer is not active"),
    TRAINER_TYPE_NOT_FOUND(HttpStatus.NOT_FOUND,       "Trainer type not found"),
    TRAINER_TYPE_EXISTS(HttpStatus.CONFLICT,           "A trainer type with this name already exists in this gym"),
    ASSIGNMENT_EXISTS(HttpStatus.CONFLICT,             "Member already has an active assignment with this trainer"),
    ASSIGNMENT_NOT_FOUND(HttpStatus.NOT_FOUND,         "Trainer assignment not found"),

    // ── Generic ───────────────────────────────────────────────────────────────
    RESOURCE_NOT_FOUND(HttpStatus.NOT_FOUND,           "Resource not found"),
    VALIDATION_ERROR(HttpStatus.BAD_REQUEST,           "Validation failed"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR,   "An unexpected error occurred");

    private final HttpStatus httpStatus;
    private final String defaultMessage;

    ErrorCode(HttpStatus httpStatus, String defaultMessage) {
        this.httpStatus    = httpStatus;
        this.defaultMessage = defaultMessage;
    }
}
