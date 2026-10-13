package com.gymapp.module.payment.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;

import java.io.IOException;
import java.time.LocalDate;

public class FlexibleLocalDateDeserializer extends JsonDeserializer<LocalDate> {

    @Override
    public LocalDate deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        String text = p.getText();
        if (text == null || text.trim().isEmpty()) {
            return null;
        }
        text = text.trim();
        if (text.contains("T")) {
            return LocalDate.parse(text.substring(0, text.indexOf("T")));
        }
        return LocalDate.parse(text);
    }
}
