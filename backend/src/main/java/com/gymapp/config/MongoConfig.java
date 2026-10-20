package com.gymapp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;

@Configuration
public class MongoConfig {

    private static final ZoneId KOLKATA = ZoneId.of("Asia/Kolkata");

    @Bean
    public MongoCustomConversions mongoCustomConversions() {
        return new MongoCustomConversions(List.of(
                new LocalDateWriteConverter(),
                new LocalDateReadConverter(),
                new LocalDateTimeWriteConverter(),
                new LocalDateTimeReadConverter()
        ));
    }

    @WritingConverter
    public static class LocalDateWriteConverter implements Converter<LocalDate, Date> {
        @Override
        public Date convert(LocalDate source) {
            return Date.from(source.atStartOfDay(KOLKATA).toInstant());
        }
    }

    @ReadingConverter
    public static class LocalDateReadConverter implements Converter<Date, LocalDate> {
        @Override
        public LocalDate convert(Date source) {
            return source.toInstant().atZone(KOLKATA).toLocalDate();
        }
    }

    @WritingConverter
    public static class LocalDateTimeWriteConverter implements Converter<LocalDateTime, Date> {
        @Override
        public Date convert(LocalDateTime source) {
            return Date.from(source.atZone(KOLKATA).toInstant());
        }
    }

    @ReadingConverter
    public static class LocalDateTimeReadConverter implements Converter<Date, LocalDateTime> {
        @Override
        public LocalDateTime convert(Date source) {
            return source.toInstant().atZone(KOLKATA).toLocalDateTime();
        }
    }
}
