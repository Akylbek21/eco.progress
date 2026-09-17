package kz.eco.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/** Adds a short, safe Cache-Control to public, non-personalized, read-only GET endpoints (news/
 *  services/service-city/case-study/region listings, sitemap.xml, robots.txt) - nginx item 6.
 *  Never applied to /api/staff/**, /api/admin/**, /api/client/**, or anything requiring auth: those
 *  responses can be user-specific and must never be cached by a shared cache. Does not touch JWT,
 *  security rules, DTOs, or business logic - purely an additive response header. ETag generation
 *  for the same paths is handled separately by Spring's built-in ShallowEtagHeaderFilter (see
 *  CacheHeadersConfig), which this filter runs alongside without interfering with it. */
@Component
public class PublicApiCacheHeadersFilter extends OncePerRequestFilter {

    /** Public, unauthenticated, non-personalized read surfaces only - see SecurityConfig's
     *  permitAll matchers for the same set of prefixes. Kept in sync with that list deliberately:
     *  a path only belongs here if it's already established as safe to serve to anyone. */
    private static final List<String> CACHEABLE_PREFIXES = List.of(
            "/api/news", "/api/services", "/api/service-city", "/api/public/content",
            "/sitemap.xml", "/robots.txt"
    );

    /** Short TTL, not "immutable": unlike Vite's hashed /assets/*, this data (news status,
     *  service catalogue, review-workflow state) can legitimately change at any time, so a shared
     *  cache must revalidate reasonably often rather than serving stale content for a year. */
    private static final String CACHE_CONTROL_VALUE = "public, max-age=300, stale-while-revalidate=60";

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                     @NonNull FilterChain filterChain) throws ServletException, IOException {
        if (isCacheableGet(request)) {
            response.setHeader("Cache-Control", CACHE_CONTROL_VALUE);
        }
        filterChain.doFilter(request, response);
    }

    private boolean isCacheableGet(HttpServletRequest request) {
        if (!HttpMethod.GET.matches(request.getMethod())) {
            return false;
        }
        String path = request.getRequestURI();
        return CACHEABLE_PREFIXES.stream().anyMatch(path::startsWith);
    }
}
