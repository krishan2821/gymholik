package com.gymapp.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

public class CorsConfigUnitTest {

    @Test
    @DisplayName("parseAllowedOrigins handles comma-separated list, trims whitespace, filters empty and *")
    void testParseAllowedOrigins() {
        SecurityConfig config = new SecurityConfig(null, null, null);

        ReflectionTestUtils.setField(config, "allowedOrigins", " http://localhost:8081 , http://localhost:19006, *,  ");
        CorsConfigurationSource source = config.corsConfigurationSource();
        CorsConfiguration corsConfig = source.getCorsConfiguration(new MockHttpServletRequest());

        assertThat(corsConfig).isNotNull();
        assertThat(corsConfig.getAllowedOrigins())
                .containsExactly("http://localhost:8081", "http://localhost:19006");
        assertThat(corsConfig.getAllowCredentials()).isTrue();
        assertThat(corsConfig.getAllowedOrigins()).doesNotContain("*");
        assertThat(corsConfig.getAllowedMethods())
                .containsExactly("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS");
        assertThat(corsConfig.getAllowedHeaders())
                .containsExactly("Authorization", "Content-Type", "Idempotency-Key", "Accept", "Origin", "X-Requested-With");
        assertThat(corsConfig.getExposedHeaders())
                .containsExactly("Retry-After");
        assertThat(corsConfig.getMaxAge()).isEqualTo(3600L);
    }

    @Test
    @DisplayName("Empty or null allowed-origins property results in empty allowed origins and allowCredentials false")
    void testEmptyAllowedOrigins() {
        SecurityConfig config = new SecurityConfig(null, null, null);

        ReflectionTestUtils.setField(config, "allowedOrigins", "");
        CorsConfigurationSource source = config.corsConfigurationSource();
        CorsConfiguration corsConfig = source.getCorsConfiguration(new MockHttpServletRequest());

        assertThat(corsConfig).isNotNull();
        assertThat(corsConfig.getAllowedOrigins()).isEmpty();
        assertThat(corsConfig.getAllowCredentials()).isFalse();
    }
}
