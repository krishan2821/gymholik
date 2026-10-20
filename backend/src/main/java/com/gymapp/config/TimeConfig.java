package com.gymapp.config;

import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;
import java.util.TimeZone;

@Configuration
public class TimeConfig {

    public static final ZoneId ASIA_KOLKATA = ZoneId.of("Asia/Kolkata");

    @PostConstruct
    public void init() {
        TimeZone.setDefault(TimeZone.getTimeZone(ASIA_KOLKATA));
    }

    @Bean
    public Clock clock() {
        return Clock.system(ASIA_KOLKATA);
    }
}
