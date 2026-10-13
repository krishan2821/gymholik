package com.gymapp.module.payment.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class IndianCurrencyUtilsTest {

    @Test
    void testAmountInWords() {
        // 1,500 rupees (150,000 paise)
        assertEquals("One Thousand Five Hundred Rupees Only",
                IndianCurrencyUtils.formatRupeesInWords(150_000L));

        // 12,345 rupees (1,234,500 paise)
        assertEquals("Twelve Thousand Three Hundred Forty Five Rupees Only",
                IndianCurrencyUtils.formatRupeesInWords(1_234_500L));

        // 1,25,000 rupees (12,500,000 paise)
        assertEquals("One Lakh Twenty Five Thousand Rupees Only",
                IndianCurrencyUtils.formatRupeesInWords(12_500_000L));
    }
}
