package kz.eco.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** nginx item 6: safe Cache-Control + ETag on public, non-personalized read-only API responses,
 *  never on authenticated/personalized ones. Purely additive response headers - no change to JWT,
 *  security rules, DTOs, or business logic. */
@SpringBootTest
@Transactional
class PublicApiCacheHeadersTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PublicApiCacheHeadersFilter cacheHeadersFilter;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        // Both the Cache-Control filter and the ETag FilterRegistrationBean are plain servlet
        // Filter beans, not part of the Spring Security chain - webAppContextSetup won't apply
        // them unless added explicitly, same reasoning as CrawlerAccessLogFilterTest.
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(cacheHeadersFilter).apply(springSecurity()).build();
    }

    @Test
    void publicNewsList_getsShortCacheControl() throws Exception {
        mvc.perform(get("/api/news"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "public, max-age=300, stale-while-revalidate=60"));
    }

    @Test
    void publicServicesList_getsShortCacheControl() throws Exception {
        mvc.perform(get("/api/services"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "public, max-age=300, stale-while-revalidate=60"));
    }

    @Test
    void unifiedPublicContentEndpoint_getsShortCacheControl() throws Exception {
        mvc.perform(get("/api/public/content/articles"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "public, max-age=300, stale-while-revalidate=60"));
    }

    @Test
    void sitemapAndRobots_getShortCacheControl() throws Exception {
        mvc.perform(get("/sitemap.xml"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "public, max-age=300, stale-while-revalidate=60"));
        mvc.perform(get("/robots.txt"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "public, max-age=300, stale-while-revalidate=60"));
    }

    /** Never cache authenticated/personalized surfaces, even if they happen to also be a GET -
     *  this is the whole point of scoping the filter to an explicit allowlist rather than "all
     *  GET requests". Both requests are unauthenticated here, so Spring Security's own 401
     *  entry point actually sets its own strict "no-cache, no-store, max-age=0, must-revalidate"
     *  - the assertion only needs to confirm our filter's public/max-age=300 value never leaks
     *  onto a non-allowlisted path, not that no Cache-Control header exists at all. */
    @Test
    void staffAndAdminAndClientEndpoints_neverGetPublicCacheControl() throws Exception {
        String publicValue = "public, max-age=300, stale-while-revalidate=60";
        mvc.perform(get("/api/staff/news")).andExpect(result -> {
            String cc = result.getResponse().getHeader("Cache-Control");
            org.junit.jupiter.api.Assertions.assertNotEquals(publicValue, cc, "staff endpoint must not carry the public Cache-Control");
        });
        mvc.perform(get("/api/admin/content/articles")).andExpect(result -> {
            String cc = result.getResponse().getHeader("Cache-Control");
            org.junit.jupiter.api.Assertions.assertNotEquals(publicValue, cc, "admin endpoint must not carry the public Cache-Control");
        });
    }
}
