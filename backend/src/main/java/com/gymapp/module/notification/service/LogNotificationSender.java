package com.gymapp.module.notification.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class LogNotificationSender implements NotificationService {

    @Override
    public void sendReminder(String toPhone, String message) {
        // Placeholder for real SMS / WhatsApp provider integration
        log.info("Sending notification to [{}]: {}", com.gymapp.common.PhoneMasker.mask(toPhone), message);
    }
}
