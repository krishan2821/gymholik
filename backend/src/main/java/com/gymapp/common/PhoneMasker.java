package com.gymapp.common;

public final class PhoneMasker {

    private PhoneMasker() {}

    /**
     * Masks phone number to show only the last 4 digits preceded by XXXXXX.
     * E.g. "9876543210" -> "XXXXXX3210"
     */
    public static String mask(String phone) {
        if (phone == null || phone.isBlank()) {
            return null;
        }
        String trimmed = phone.trim();
        if (trimmed.length() <= 4) {
            return "XXXXXX" + trimmed;
        }
        return "XXXXXX" + trimmed.substring(trimmed.length() - 4);
    }
}
