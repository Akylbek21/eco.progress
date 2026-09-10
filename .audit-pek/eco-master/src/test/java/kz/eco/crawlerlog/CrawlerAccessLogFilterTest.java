package kz.eco.crawlerlog;

import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Infrastructure item 2: only known AI/search crawlers are logged, never ordinary user traffic. */
@SpringBootTest
@Transactional
class CrawlerAccessLogFilterTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CrawlerAccessLogRepository repository;
    @Autowired private CrawlerAccessLogFilter filter;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        // MockMvc's webAppContextSetup does NOT auto-apply servlet-container-level Filter beans
        // (only springSecurity() wires in the security chain) - the crawler filter must be added
        // explicitly here to be exercised at all, exactly as it would run in the real servlet
        // container via Spring Boot's auto FilterRegistrationBean.
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(filter).apply(springSecurity()).build();
    }

    @Test
    void detectCrawler_recognizesOaiSearchBot() {
        assertEquals("OAI-SearchBot", filter.detectCrawler("Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)"));
    }

    @Test
    void detectCrawler_recognizesGooglebotAndBingbot() {
        assertEquals("Googlebot", filter.detectCrawler("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"));
        assertEquals("Bingbot", filter.detectCrawler("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"));
    }

    @Test
    void detectCrawler_returnsNullForOrdinaryBrowserTraffic() {
        assertNull(filter.detectCrawler("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"));
    }

    @Test
    void oaiSearchBotHit_isLoggedWithStatusAndTiming() throws Exception {
        mvc.perform(get("/sitemap.xml").header("User-Agent", "OAI-SearchBot/1.0"))
                .andExpect(status().isOk());

        List<CrawlerAccessLog> logs = repository.findAllByCrawlerNameOrderByRequestedAtDesc("OAI-SearchBot");
        org.junit.jupiter.api.Assertions.assertFalse(logs.isEmpty());
        CrawlerAccessLog log = logs.get(0);
        assertEquals(200, log.getStatusCode());
        assertEquals("/sitemap.xml", log.getRequestUrl());
        org.junit.jupiter.api.Assertions.assertNotNull(log.getRequestedAt());
    }

    @Test
    void ordinaryBrowserHit_isNeverLogged() throws Exception {
        mvc.perform(get("/sitemap.xml").header("User-Agent", "Mozilla/5.0 Chrome/120.0"))
                .andExpect(status().isOk());
        long before = repository.count();
        mvc.perform(get("/sitemap.xml").header("User-Agent", "Mozilla/5.0 Chrome/120.0"))
                .andExpect(status().isOk());
        assertEquals(before, repository.count());
    }

    @Test
    void adminEndpoint_isForbiddenForNonAdmin() throws Exception {
        User manager = new User();
        manager.setEmail("crawler-manager-" + System.nanoTime() + "@test.kz");
        manager.setPasswordHash(passwordEncoder.encode("demo123"));
        manager.setName("Manager");
        manager.setRole(UserRole.MANAGER);
        manager.setType(ClientType.staff);
        userRepository.save(manager);
        RequestPostProcessor as = authentication(new UsernamePasswordAuthenticationToken(
                manager, null, List.of(new SimpleGrantedAuthority("ROLE_MANAGER"))));

        mvc.perform(get("/api/admin/analytics/crawler-logs").with(as))
                .andExpect(status().isForbidden());
    }
}
