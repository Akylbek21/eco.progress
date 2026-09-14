package kz.eco.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

/** Registers Spring's built-in weak-ETag filter (nginx item 6), scoped to exactly the same public,
 *  non-personalized read endpoints as {@link PublicApiCacheHeadersFilter}. ShallowEtagHeaderFilter
 *  hashes the response body and returns 304 Not Modified on a matching If-None-Match - purely a
 *  transport-level optimization, it never touches the JSON body, DTOs, or any business logic.
 *  Never registered for /api/staff/**, /api/admin/**, /api/client/**, or auth-dependent responses. */
@Configuration
public class CacheHeadersConfig {

    @Bean
    public FilterRegistrationBean<ShallowEtagHeaderFilter> publicApiEtagFilter() {
        FilterRegistrationBean<ShallowEtagHeaderFilter> registration =
                new FilterRegistrationBean<>(new ShallowEtagHeaderFilter());
        registration.addUrlPatterns(
                "/api/news", "/api/news/*",
                "/api/services", "/api/services/*",
                "/api/service-city/*",
                "/api/public/content/*",
                "/sitemap.xml",
                "/robots.txt"
        );
        registration.setName("publicApiEtagFilter");
        return registration;
    }
}
