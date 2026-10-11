package com.gymapp.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Safely resolves the client IP address for rate limiting.
 *
 * Security rule:
 *  - Trust proxy headers (CF-Connecting-IP, X-Forwarded-For) ONLY when the immediate
 *    connection (request.getRemoteAddr()) originates from the local Cloudflare tunnel
 *    or an explicitly configured trusted proxy address.
 *  - If a request arrives directly from an untrusted remoteAddr, any X-Forwarded-For or
 *    CF-Connecting-IP header is ignored to prevent rate-limit bypass via header spoofing.
 */
@Component
public class ClientIpResolver {

    private static final Pattern SAFE_IP_PATTERN = Pattern.compile("^[0-9a-fA-F.:]{2,45}$");

    private final Set<String> trustedProxies;

    public ClientIpResolver(
            @Value("${app.security.trusted-proxies:127.0.0.1,::1,0:0:0:0:0:0:0:1}") String trustedProxiesConfig) {
        this.trustedProxies = Arrays.stream(trustedProxiesConfig.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .collect(Collectors.toUnmodifiableSet());
    }

    public String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }
        String remoteAddr = request.getRemoteAddr();
        if (!StringUtils.hasText(remoteAddr)) {
            return "unknown";
        }
        String normalizedRemote = remoteAddr.trim();

        // Only trust forwarded headers when the TCP peer is the Cloudflare tunnel / trusted proxy
        if (isTrustedProxy(normalizedRemote)) {
            String cfIp = extractValidIp(request.getHeader("CF-Connecting-IP"));
            if (cfIp != null) {
                return cfIp;
            }

            String xff = request.getHeader("X-Forwarded-For");
            if (StringUtils.hasText(xff)) {
                // Take the first valid non-trusted IP from X-Forwarded-For, or first valid IP
                String[] parts = xff.split(",");
                for (String part : parts) {
                    String candidate = extractValidIp(part);
                    if (candidate != null && !isTrustedProxy(candidate)) {
                        return candidate;
                    }
                }
                String firstValid = extractValidIp(parts[0]);
                if (firstValid != null) {
                    return firstValid;
                }
            }
        }

        return normalizedRemote;
    }

    public boolean isTrustedProxy(String ip) {
        return StringUtils.hasText(ip) && trustedProxies.contains(ip.trim());
    }

    private String extractValidIp(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String trimmed = raw.trim();
        if (SAFE_IP_PATTERN.matcher(trimmed).matches()) {
            return trimmed;
        }
        return null;
    }
}
