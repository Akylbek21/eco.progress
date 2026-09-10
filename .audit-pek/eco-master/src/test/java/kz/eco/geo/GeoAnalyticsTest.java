package kz.eco.geo;

import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Analytics items 1-3: GEO/AI referral sources stay in distinct buckets (never blended with
 *  Google-organic), and the GEO Query Monitor is check-result storage only, never a scraper. */
@SpringBootTest
@Transactional
class GeoAnalyticsTest {

    @Autowired private WebApplicationContext context;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private GeoMonitoredQueryRepository queryRepository;

    private MockMvc mvc;
    private User admin;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        admin = new User();
        admin.setEmail("geo-admin-" + System.nanoTime() + "@test.kz");
        admin.setPasswordHash(passwordEncoder.encode("demo123"));
        admin.setName("Admin");
        admin.setRole(UserRole.ADMIN);
        admin.setType(ClientType.staff);
        admin = userRepository.save(admin);
    }

    private RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name()))));
    }

    @Test
    void referralEvents_areRecordedInDistinctSourceBuckets() throws Exception {
        mvc.perform(post("/api/admin/analytics/geo-referrals").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"source":"CHATGPT_REFERRAL","medium":"ai-referral","landingPage":"/uslugi/ndv",
                                 "sessions":12,"conversions":2,"leadCount":1,"periodStart":"2026-08-01","periodEnd":"2026-08-07"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.source").value("CHATGPT_REFERRAL"));

        mvc.perform(post("/api/admin/analytics/geo-referrals").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"source":"GOOGLE_ORGANIC","medium":"organic","landingPage":"/uslugi/ndv",
                                 "sessions":300,"conversions":10,"leadCount":6,"periodStart":"2026-08-01","periodEnd":"2026-08-07"}
                                """))
                .andExpect(status().isOk());

        String chatgptOnly = mvc.perform(get("/api/admin/analytics/geo-referrals").param("source", "CHATGPT_REFERRAL").with(as(admin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(chatgptOnly.contains("CHATGPT_REFERRAL"));
        assertTrue(!chatgptOnly.contains("GOOGLE_ORGANIC"));
    }

    @Test
    void monitoredQueries_areSeeded_between30And50() {
        long count = queryRepository.count();
        assertTrue(count >= 30 && count <= 50, "expected 30-50 seeded GEO queries, got " + count);
    }

    @Test
    void recordCheck_updatesVisibilityAndIsVersionChecked() throws Exception {
        GeoMonitoredQuery q = new GeoMonitoredQuery();
        q.setQuery("Тестовый запрос для проверки GEO");
        q.setIntent(QueryIntent.INFORMATIONAL);
        q = queryRepository.save(q);

        mvc.perform(post("/api/admin/analytics/geo-queries/" + q.getId() + "/record-check").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ourBrandMentioned\":true,\"ourUrlCited\":true,\"competitors\":[\"Competitor A\"],\"version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ourBrandMentioned").value(true))
                .andExpect(jsonPath("$.data.ourUrlCited").value(true))
                .andExpect(jsonPath("$.data.lastCheckedAt").isNotEmpty());

        mvc.perform(post("/api/admin/analytics/geo-queries/" + q.getId() + "/record-check").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ourBrandMentioned\":false,\"ourUrlCited\":false,\"competitors\":[],\"version\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }
}
