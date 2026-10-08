package com.gymapp.common;

/**
 * Per-request tenant context stored in a ThreadLocal.
 * Set by JwtFilter at request entry and cleared in the finally block
 * to prevent thread-pool leaks.
 */
public final class TenantContext {

    private static final ThreadLocal<String> GYM_ID_HOLDER = new ThreadLocal<>();

    private TenantContext() {}

    public static void setGymId(String gymId) {
        GYM_ID_HOLDER.set(gymId);
    }

    /** Returns the gymId for the current request, or null for SUPER_ADMIN requests. */
    public static String getGymId() {
        return GYM_ID_HOLDER.get();
    }

    /** Must be called in a finally block after every request to prevent leaks. */
    public static void clear() {
        GYM_ID_HOLDER.remove();
    }
}
