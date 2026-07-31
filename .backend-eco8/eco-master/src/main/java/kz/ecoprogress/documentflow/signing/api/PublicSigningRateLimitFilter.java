package kz.ecoprogress.documentflow.signing.api;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Public/anonymous token-based signing endpoints ({@code /api/public/document-flow/signing/**})
 * have no JWT and no per-user identity to rate-limit on, which makes them a brute-force/token-
 * guessing target - see the module audit ("no rate limiting on public signing endpoints").
 *
 * <p>This is a plain in-memory fixed-window limiter, not a distributed one (no Redis dependency
 * exists in this codebase yet) - it protects a single instance. If the app is ever scaled
 * horizontally behind a load balancer, this stops being a real limit (each instance gets its own
 * budget) and should be replaced with a shared store, the same documented limitation pattern as
 * {@link kz.ecoprogress.documentflow.subscription.DocumentFlowSubscriptionExpirationJob}.
 *
 * <p>Limits per client IP within a rolling window: {@link #WINDOW_MILLIS} / {@link #MAX_REQUESTS}.
 * The token itself is not used as a key - an attacker enumerating tokens supplies a different
 * token on every request, so limiting has to key on the one thing that doesn't change: the IP.
 */
@Component
public class PublicSigningRateLimitFilter extends OncePerRequestFilter {

    private static final String PATH_PREFIX = "/api/public/document-flow/signing/";
    private static final long WINDOW_MILLIS = 60_000L;
    private static final int MAX_REQUESTS = 30;
    private static final long ENTRY_TTL_MILLIS = 10 * 60_000L;

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    private static final class Window {
        final AtomicInteger count = new AtomicInteger(0);
        volatile long windowStart = System.currentTimeMillis();
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        if (!request.getRequestURI().startsWith(PATH_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = clientIp(request);
        Window window = windows.computeIfAbsent(key, k -> new Window());
        long now = System.currentTimeMillis();
        synchronized (window) {
            if (now - window.windowStart > WINDOW_MILLIS) {
                window.windowStart = now;
                window.count.set(0);
            }
            if (window.count.incrementAndGet() > MAX_REQUESTS) {
                response.setStatus(429);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"code\":\"RATE_LIMIT_EXCEEDED\","
                        + "\"message\":\"Слишком много запросов, повторите попытку позже\","
                        + "\"timestamp\":\"" + Instant.now() + "\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    /** Periodically evict idle windows so long-running instances don't accumulate one entry per
     *  distinct IP forever. */
    @Scheduled(fixedRate = ENTRY_TTL_MILLIS)
    void evictStale() {
        long now = System.currentTimeMillis();
        windows.entrySet().removeIf(e -> now - e.getValue().windowStart > ENTRY_TTL_MILLIS);
    }

    private String clientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
