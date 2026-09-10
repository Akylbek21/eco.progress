package kz.eco.crawlerlog;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** Records every hit from a known AI/search crawler (Infrastructure item 2) - timestamp, User-Agent,
 *  URL, status, response time. Ordinary user traffic is deliberately never written here: only a
 *  User-Agent that matches one of the known crawler signatures below is logged at all, so this
 *  table can never be mistaken for general traffic analytics. */
@Component
public class CrawlerAccessLogFilter extends OncePerRequestFilter {

    /** Order matters only in that the first matching entry wins - these signatures don't overlap
     *  in practice. Extend this map, not the filter logic, to track additional crawlers. */
    private static final Map<String, String> KNOWN_CRAWLER_SIGNATURES = new LinkedHashMap<>();
    static {
        KNOWN_CRAWLER_SIGNATURES.put("OAI-SearchBot", "OAI-SearchBot");
        KNOWN_CRAWLER_SIGNATURES.put("GPTBot", "GPTBot");
        KNOWN_CRAWLER_SIGNATURES.put("ChatGPT-User", "ChatGPT-User");
        KNOWN_CRAWLER_SIGNATURES.put("Googlebot", "Googlebot");
        KNOWN_CRAWLER_SIGNATURES.put("bingbot", "Bingbot");
        KNOWN_CRAWLER_SIGNATURES.put("PerplexityBot", "PerplexityBot");
        KNOWN_CRAWLER_SIGNATURES.put("ClaudeBot", "ClaudeBot");
    }

    private final CrawlerAccessLogRepository repository;

    public CrawlerAccessLogFilter(CrawlerAccessLogRepository repository) {
        this.repository = repository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        String userAgent = request.getHeader("User-Agent");
        String crawlerName = detectCrawler(userAgent);

        if (crawlerName == null) {
            filterChain.doFilter(request, response);
            return;
        }

        long start = System.currentTimeMillis();
        try {
            filterChain.doFilter(request, response);
        } finally {
            long elapsedMs = System.currentTimeMillis() - start;
            CrawlerAccessLog entry = new CrawlerAccessLog();
            entry.setCrawlerName(crawlerName);
            entry.setUserAgent(userAgent);
            entry.setRequestUrl(request.getRequestURI() + (request.getQueryString() != null ? "?" + request.getQueryString() : ""));
            entry.setStatusCode(response.getStatus());
            entry.setResponseTimeMs(elapsedMs);
            entry.setRequestedAt(Instant.now());
            repository.save(entry);
        }
    }

    /** Package-visible for testing - returns the canonical crawler name, or null if this
     *  User-Agent doesn't match any known AI/search crawler (i.e. it's ordinary user traffic). */
    String detectCrawler(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return null;
        }
        for (Map.Entry<String, String> signature : KNOWN_CRAWLER_SIGNATURES.entrySet()) {
            if (userAgent.contains(signature.getKey())) {
                return signature.getValue();
            }
        }
        return null;
    }
}
