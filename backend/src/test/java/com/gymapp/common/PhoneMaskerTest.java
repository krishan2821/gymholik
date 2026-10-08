package com.gymapp.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("PhoneMasker Unit Tests")
class PhoneMaskerTest {

    @Test
    @DisplayName("mask() correctly masks standard 10-digit Indian phone numbers")
    void testMaskStandardPhone() {
        assertThat(PhoneMasker.mask("9876543210")).isEqualTo("XXXXXX3210");
        assertThat(PhoneMasker.mask("9123456789")).isEqualTo("XXXXXX6789");
    }

    @Test
    @DisplayName("mask() handles null, empty and short strings gracefully")
    void testMaskEdgeCases() {
        assertThat(PhoneMasker.mask(null)).isNull();
        assertThat(PhoneMasker.mask("")).isNull();
        assertThat(PhoneMasker.mask("   ")).isNull();
        assertThat(PhoneMasker.mask("12")).isEqualTo("XXXXXX12");
        assertThat(PhoneMasker.mask("1234")).isEqualTo("XXXXXX1234");
    }
}
