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

/**
 * Public/anonymous token-based signing endpoints ({@code /api/public/document-flow/signing/**})
 * have no JWT and no per-user identity to rate-limit on, which makes them a brute-force/token-
 * guessing target - see the module audit ("no rate limiting on public signing endpoints").
 *
 * <p>The counter is stored in the shared relational database, so every application replica uses
 * the same budget. No raw invitation token or IP is persisted: only a SHA-256 hash of the
 * IP/token-bearing path/endpoint tuple is used as the key.
 *
 * <p>Limits per client IP within a rolling window: {@link #WINDOW_MILLIS} / {@link #MAX_REQUESTS}.
 * The token itself is not used as a key - an attacker enumerating tokens supplies a different
 * token on every request, so limiting has to key on the one thing that doesn't change: the IP.
 */
@Component
public class PublicSigningRateLimitFilter extends OncePerRequestFilter {

    private static final String PATH_PREFIX = "/api/public/document-flow/signing/";
    private static final long ENTRY_TTL_MILLIS = 10 * 60_000L;
    private final PublicSigningRateLimitService rateLimitService;

    public PublicSigningRateLimitFilter(PublicSigningRateLimitService rateLimitService) {
        this.rateLimitService = rateLimitService;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                     @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        if (!request.getRequestURI().startsWith(PATH_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = kz.ecoprogress.documentflow.signing.Sha256Util.sha256Hex(
                clientIp(request) + "|" + request.getRequestURI() + "|" + request.getMethod());
        if (!rateLimitService.allow(key)) {
                response.setStatus(429);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"code\":\"RATE_LIMIT_EXCEEDED\","
                        + "\"message\":\"Слишком много запросов, повторите попытку позже\","
                        + "\"timestamp\":\"" + Instant.now() + "\"}");
                return;
        }

        filterChain.doFilter(request, response);
    }

    /** Periodically evict idle windows so long-running instances don't accumulate one entry per
     *  distinct IP forever. */
    @Scheduled(fixedRate = ENTRY_TTL_MILLIS)
    void evictStale() {
        rateLimitService.cleanup();
    }

    private String clientIp(HttpServletRequest request) {
        // Never trust a caller-controlled X-Forwarded-For here. In deployments behind a trusted
        // proxy, container/server forwarding support must first normalize remoteAddr.
        return request.getRemoteAddr();
    }
}
