package com.gymapp.module.auth.service;

import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public final class IndianStates {

    private IndianStates() {}

    public static final Set<String> STATES_AND_UTS = Collections.unmodifiableSet(
            Stream.of(
                    // 28 States
                    "Andhra Pradesh",
                    "Arunachal Pradesh",
                    "Assam",
                    "Bihar",
                    "Chhattisgarh",
                    "Goa",
                    "Gujarat",
                    "Haryana",
                    "Himachal Pradesh",
                    "Jharkhand",
                    "Karnataka",
                    "Kerala",
                    "Madhya Pradesh",
                    "Maharashtra",
                    "Manipur",
                    "Meghalaya",
                    "Mizoram",
                    "Nagaland",
                    "Odisha",
                    "Punjab",
                    "Rajasthan",
                    "Sikkim",
                    "Tamil Nadu",
                    "Telangana",
                    "Tripura",
                    "Uttar Pradesh",
                    "Uttarakhand",
                    "West Bengal",
                    // 8 UTs
                    "Andaman and Nicobar Islands",
                    "Chandigarh",
                    "Dadra and Nagar Haveli and Daman and Diu",
                    "Delhi",
                    "Jammu and Kashmir",
                    "Ladakh",
                    "Lakshadweep",
                    "Puducherry"
            ).collect(Collectors.toSet())
    );

    private static final Set<String> NORMALIZED_SET = Collections.unmodifiableSet(
            STATES_AND_UTS.stream()
                    .map(s -> s.trim().toLowerCase())
                    .collect(Collectors.toSet())
    );

    public static boolean isValidState(String state) {
        if (state == null) {
            return false;
        }
        return NORMALIZED_SET.contains(state.trim().toLowerCase());
    }

    public static String canonicalName(String state) {
        if (state == null) {
            return null;
        }
        String trimmed = state.trim();
        for (String validName : STATES_AND_UTS) {
            if (validName.equalsIgnoreCase(trimmed)) {
                return validName;
            }
        }
        return trimmed;
    }
}
