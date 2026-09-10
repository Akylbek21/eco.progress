package kz.eco.content;

import kz.eco.news.News;
import kz.eco.news.NewsRepository;
import kz.eco.services.EcoService;
import kz.eco.services.EcoServiceRepository;
import kz.eco.services.ServiceCategory;
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

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Single-source-of-truth sitemap and indexability contract tests.
 *
 * Verifies:
 * 1. Sitemap contains no noindex URLs (only APPROVED/PUBLISHED indexable content).
 * 2. APPROVED news are served with index,follow robots directive.
 * 3. DRAFT/IN_REVIEW news have noindex,follow and are absent from the sitemap.
 * 4. Approved EcoService pages appear in the sitemap; inactive/draft services do not.
 * 5. news.sources field is present in the DTO and included in Article JSON-LD.
 * 6. Services expose full AEO content (non-null aeo block with expected fields).
 */
@SpringBootTest
@Transactional
class SitemapAndIndexabilityContractTest {

    @Autowired private WebApplicationContext context;
    @Autowired private NewsRepository newsRepository;
    @Autowired private EcoServiceRepository ecoServiceRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private MockMvc mvc;
    private User admin;

    private static final String ADMIN_ARTICLES = "/api/admin/content/articles";

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        admin = createUser("sitemap-admin-", UserRole.ADMIN);
    }

    // ── Sitemap: only indexable URLs ─────────────────────────────────────────────────────────────

    @Test
    void sitemap_containsOnlyApprovedOrPublished_news() throws Exception {
        News approved = approvedNews("sitemap-approved-" + System.nanoTime(), "Утверждённая статья");
        News draft = draftNews("sitemap-draft-" + System.nanoTime(), "Черновик");

        String xml = sitemap();
        assertTrue(xml.contains(approved.getId()), "approved news must be in sitemap");
        assertFalse(xml.contains(draft.getId()), "draft news must NOT be in sitemap");
    }

    @Test
    void sitemap_doesNotContainNoindexUrls() throws Exception {
        // Any URL in the sitemap must be index,follow - draft/IN_REVIEW must never appear.
        // Create one approved and one draft; verify sitemap has no draft slug.
        News approved = approvedNews("noindex-check-approved-" + System.nanoTime(), "Индексируемая статья");
        News draft = draftNews("noindex-check-draft-" + System.nanoTime(), "Не индексируемая статья");

        String xml = sitemap();
        // Approved is in sitemap - its page is index,follow, so it belongs here.
        assertTrue(xml.contains(approved.getId()));
        // Draft slug must be completely absent - its robots would be noindex,follow.
        assertFalse(xml.contains(draft.getId()),
                "noindex URLs (draft) must never appear in sitemap");
    }

    @Test
    void sitemap_includesApprovedEcoService_excludesInactiveOrDraftService() throws Exception {
        EcoService approved = approvedService("Экологический аудит");
        EcoService inactive = inactiveService("Снятая услуга");
        EcoService draft = draftService("Черновик услуги");

        String xml = sitemap();
        assertTrue(xml.contains(approved.getId()), "active+approved service must appear in sitemap");
        assertFalse(xml.contains(inactive.getId()), "inactive service must NOT appear in sitemap");
        assertFalse(xml.contains(draft.getId()), "draft service must NOT appear in sitemap");
    }

    @Test
    void sitemap_afterRevokeApproval_dropsNewsUrl() throws Exception {
        News n = draftNews("revoke-sitemap-" + System.nanoTime(), "Статья для отзыва");
        String id = n.getId();

        // Push through the full workflow to APPROVED
        mvc.perform(post(ADMIN_ARTICLES + "/" + id + "/submit-review").with(as(admin))
                        .contentType(APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isOk());
        mvc.perform(post(ADMIN_ARTICLES + "/" + id + "/approve").with(as(admin))
                        .contentType(APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());

        assertTrue(sitemap().contains(id), "approved news must be in sitemap");

        // Revoke - drops immediately from sitemap (no cache to clear)
        mvc.perform(post(ADMIN_ARTICLES + "/" + id + "/revoke-approval").with(as(admin))
                        .contentType(APPLICATION_JSON).content("{\"reason\":\"Устаревшие данные\",\"version\":2}"))
                .andExpect(status().isOk());

        assertFalse(sitemap().contains(id), "revoked news must be absent from sitemap immediately");
    }

    // ── Robots directive: APPROVED → index,follow; others → noindex,follow ───────────────────────

    @Test
    void approvedNews_hasIndexFollow_robots() throws Exception {
        News n = approvedNews("robots-approved-" + System.nanoTime(), "Проверка robots");

        mvc.perform(get("/api/news/" + n.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewStatus").value("APPROVED"))
                .andExpect(jsonPath("$.data.seo.robots").value("index,follow"));
    }

    @Test
    void draftNews_hasNoindexFollow_robots() throws Exception {
        News n = draftNews("robots-draft-" + System.nanoTime(), "Черновик статья");

        mvc.perform(get("/api/news/" + n.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewStatus").value("DRAFT"))
                .andExpect(jsonPath("$.data.seo.robots").value("noindex,follow"));
    }

    @Test
    void approvedService_hasIndexFollow_robots() throws Exception {
        EcoService s = approvedService("Услуга с robots index");

        mvc.perform(get("/api/public/content/services/" + s.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.seo.robots").value("index,follow"));
    }

    @Test
    void inactiveService_hasNoindexFollow_robots() throws Exception {
        EcoService s = inactiveService("Неактивная услуга robots");

        mvc.perform(get("/api/public/content/services/" + s.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.seo.robots").value("noindex,follow"));
    }

    // ── news.sources: DTO field present and wired to JSON-LD ─────────────────────────────────────

    @Test
    void newsResponse_containsSources_field() throws Exception {
        News n = draftNews("sources-field-" + System.nanoTime(), "Статья с источниками");
        n.setSources(new java.util.ArrayList<>(List.of("https://gov.kz/doc/2024", "ГОСТ Р 56828.15-2016")));
        newsRepository.saveAndFlush(n);

        mvc.perform(get("/api/news/" + n.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sources").isArray())
                .andExpect(jsonPath("$.data.sources[0]").value("https://gov.kz/doc/2024"))
                .andExpect(jsonPath("$.data.sources[1]").value("ГОСТ Р 56828.15-2016"));
    }

    @Test
    void newsResponse_sources_emptyByDefault() throws Exception {
        News n = draftNews("sources-empty-" + System.nanoTime(), "Статья без источников");

        mvc.perform(get("/api/news/" + n.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sources").isArray())
                .andExpect(jsonPath("$.data.sources").isEmpty());
    }

    @Test
    void newsResponse_withSources_includesCitationInJsonLd() throws Exception {
        News n = approvedNews("sources-jsonld-" + System.nanoTime(), "Статья с цитатами");
        n.setSources(new java.util.ArrayList<>(List.of("https://mineco.gov.kz/report2024")));
        newsRepository.saveAndFlush(n);

        mvc.perform(get("/api/news/" + n.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.seo.jsonLd.citation").isArray())
                .andExpect(jsonPath("$.data.seo.jsonLd.citation[0]['@type']").value("CreativeWork"))
                .andExpect(jsonPath("$.data.seo.jsonLd.citation[0].url").value("https://mineco.gov.kz/report2024"));
    }

    // ── AEO content: services expose full structured AEO block ───────────────────────────────────

    @Test
    void service_publicResponse_containsAeoBlock_withExpectedFields() throws Exception {
        EcoService s = approvedServiceWithAeo("Услуга с AEO");

        mvc.perform(get("/api/public/content/services/" + s.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.aeo").exists())
                .andExpect(jsonPath("$.data.aeo.shortAnswer").value("Краткий ответ на вопрос об услуге"))
                .andExpect(jsonPath("$.data.aeo.whoNeeds").value("Промышленные предприятия"))
                .andExpect(jsonPath("$.data.aeo.whenRequired").value("При превышении ПДК"))
                .andExpect(jsonPath("$.data.aeo.whenNotRequired").value("Для малого бизнеса без производства"))
                .andExpect(jsonPath("$.data.aeo.requiredDocuments").isArray())
                .andExpect(jsonPath("$.data.aeo.customerReceives").isArray())
                .andExpect(jsonPath("$.data.aeo.timeline").value("2 недели"))
                .andExpect(jsonPath("$.data.aeo.pricingFactors").isArray())
                .andExpect(jsonPath("$.data.aeo.legalBasis").isArray())
                .andExpect(jsonPath("$.data.aeo.commonMistakes").isArray())
                .andExpect(jsonPath("$.data.aeo.faq").isArray());
    }

    @Test
    void service_publicResponse_aeoBlock_isNeverNull() throws Exception {
        // Even a service with no AEO content filled in should return an aeo block (empty fields),
        // not a null - this is the FE contract: aeo is always an object, never missing.
        EcoService s = approvedService("Услуга без AEO");

        mvc.perform(get("/api/public/content/services/" + s.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.aeo").exists())
                .andExpect(jsonPath("$.data.aeo.requiredDocuments").isArray())
                .andExpect(jsonPath("$.data.aeo.faq").isArray());
    }

    // ── News DTO shape: all required FE contract fields present ──────────────────────────────────

    @Test
    void newsResponse_hasAllContractFields() throws Exception {
        News n = approvedNews("contract-fields-" + System.nanoTime(), "Полный контракт");
        n.setSources(new java.util.ArrayList<>(List.of("https://example.kz")));
        newsRepository.saveAndFlush(n);

        mvc.perform(get("/api/news/" + n.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").exists())
                .andExpect(jsonPath("$.data.title").exists())
                .andExpect(jsonPath("$.data.excerpt").exists())
                .andExpect(jsonPath("$.data.content").isArray())
                .andExpect(jsonPath("$.data.sources").isArray())
                .andExpect(jsonPath("$.data.reviewStatus").exists())
                .andExpect(jsonPath("$.data.status").exists())
                .andExpect(jsonPath("$.data.reviewedAt").exists())
                .andExpect(jsonPath("$.data.reviewer").exists())
                .andExpect(jsonPath("$.data.author").exists())
                .andExpect(jsonPath("$.data.seo.robots").exists())
                .andExpect(jsonPath("$.data.seo.canonicalUrl").exists())
                .andExpect(jsonPath("$.data.seo.jsonLd").exists());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────────────────────

    private String sitemap() throws Exception {
        return mvc.perform(get("/sitemap.xml"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private User createUser(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@test.kz");
        u.setPasswordHash(passwordEncoder.encode("demo123"));
        u.setName(role.name() + " Test");
        u.setRole(role);
        u.setType(ClientType.staff);
        return userRepository.save(u);
    }

    private RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name()))));
    }

    private News approvedNews(String id, String title) {
        News n = new News();
        n.setId(id);
        n.setTitle(title);
        n.setExcerpt("Краткое описание статьи для тестирования контракта.");
        n.setCategory("Экология");
        n.setPublishedAt(LocalDate.now());
        n.setContent(List.of("Первый абзац.", "Второй абзац."));
        n.setReviewStatus(ContentStatus.APPROVED);
        n.setAuthorId(admin.getId());
        n.setReviewerId(admin.getId());
        n.setReviewedAt(Instant.now());
        return newsRepository.saveAndFlush(n);
    }

    private News draftNews(String id, String title) {
        News n = new News();
        n.setId(id);
        n.setTitle(title);
        n.setExcerpt("Черновик для тестирования.");
        n.setCategory("Экология");
        n.setPublishedAt(LocalDate.now());
        n.setContent(List.of("Черновой текст."));
        n.setReviewStatus(ContentStatus.DRAFT);
        n.setAuthorId(admin.getId());
        return newsRepository.saveAndFlush(n);
    }

    private EcoService approvedService(String title) {
        EcoService s = new EcoService();
        s.setId("svc-" + System.nanoTime());
        s.setTitle(title);
        s.setCategory(ServiceCategory.PERMITS);
        s.setDescription("Описание услуги для тестирования.");
        s.setForWhom("Предприятия");
        s.setResult("Пакет документов");
        s.setDuration("2 недели");
        s.setIcon("audit");
        s.setActive(true);
        s.setContentStatus(ContentStatus.APPROVED);
        s.setAuthorId(admin.getId());
        s.setReviewerId(admin.getId());
        s.setReviewedAt(Instant.now());
        s.setIncludes(List.of());
        s.setDocuments(List.of());
        s.setWorkflow(List.of());
        return ecoServiceRepository.saveAndFlush(s);
    }

    private EcoService approvedServiceWithAeo(String title) {
        EcoService s = approvedService(title);
        s.setShortAnswer("Краткий ответ на вопрос об услуге");
        s.setWhoNeeds("Промышленные предприятия");
        s.setWhenRequired("При превышении ПДК");
        s.setWhenNotRequired("Для малого бизнеса без производства");
        s.setRequiredDocuments(new java.util.ArrayList<>(List.of("Доверенность", "Данные об объекте")));
        s.setCustomerReceives(new java.util.ArrayList<>(List.of("Готовый отчёт", "Разрешение")));
        s.setTimeline("2 недели");
        s.setPricingFactors(new java.util.ArrayList<>(List.of("Площадь объекта", "Количество источников")));
        s.setLegalBasis(new java.util.ArrayList<>(List.of("Экологический кодекс РК, ст. 175")));
        s.setCommonMistakes(new java.util.ArrayList<>(List.of("Подача без актуальных данных")));
        s.setFaq(new java.util.ArrayList<>(List.of(
                new kz.eco.content.FaqItem("Сколько стоит услуга?", "Зависит от объёма работ."))));
        return ecoServiceRepository.saveAndFlush(s);
    }

    private EcoService inactiveService(String title) {
        EcoService s = new EcoService();
        s.setId("svc-inactive-" + System.nanoTime());
        s.setTitle(title);
        s.setCategory(ServiceCategory.PERMITS);
        s.setDescription("Снятая с публикации услуга.");
        s.setForWhom("—");
        s.setResult("—");
        s.setDuration("—");
        s.setIcon("removed");
        s.setActive(false);
        s.setContentStatus(ContentStatus.APPROVED);
        s.setAuthorId(admin.getId());
        s.setIncludes(List.of());
        s.setDocuments(List.of());
        s.setWorkflow(List.of());
        return ecoServiceRepository.saveAndFlush(s);
    }

    private EcoService draftService(String title) {
        EcoService s = new EcoService();
        s.setId("svc-draft-" + System.nanoTime());
        s.setTitle(title);
        s.setCategory(ServiceCategory.PERMITS);
        s.setDescription("Черновик услуги.");
        s.setForWhom("—");
        s.setResult("—");
        s.setDuration("—");
        s.setIcon("draft");
        s.setActive(true);
        s.setContentStatus(ContentStatus.DRAFT);
        s.setAuthorId(admin.getId());
        s.setIncludes(List.of());
        s.setDocuments(List.of());
        s.setWorkflow(List.of());
        return ecoServiceRepository.saveAndFlush(s);
    }
}
