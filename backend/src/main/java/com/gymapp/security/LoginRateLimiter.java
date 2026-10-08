package com.gymapp.security;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Component
public class LoginRateLimiter {

    private static final long TIME_WINDOW_MS = TimeUnit.MINUTES.toMillis(1);
    private static final int MAX_REQUESTS_PER_MINUTE = 5;

    private final Map<String, RequestInfo> ipRequestCounts = new ConcurrentHashMap<>();

    public boolean isAllowed(String ipAddress) {
        long now = System.currentTimeMillis();
        ipRequestCounts.compute(ipAddress, (key, requestInfo) -> {
            if (requestInfo == null || (now - requestInfo.windowStartTime) > TIME_WINDOW_MS) {
                return new RequestInfo(now, 1);
            }
            requestInfo.count++;
            return requestInfo;
        });

        RequestInfo info = ipRequestCounts.get(ipAddress);
        return info.count <= MAX_REQUESTS_PER_MINUTE;
    }

    public void reset() {
        ipRequestCounts.clear();
    }

    private static class RequestInfo {
        long windowStartTime;
        int count;

        RequestInfo(long windowStartTime, int count) {
            this.windowStartTime = windowStartTime;
            this.count = count;
        }
    }
}
