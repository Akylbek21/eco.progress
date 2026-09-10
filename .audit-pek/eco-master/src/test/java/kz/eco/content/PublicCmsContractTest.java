package kz.eco.content;

import kz.eco.news.News;
import kz.eco.news.NewsRepository;
import kz.eco.services.EcoService;
import kz.eco.services.ServiceCategory;
import kz.eco.services.EcoServiceRepository;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.time.Instant;
import java.time.LocalDate;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FE↔BE contract tests for all 5 public CMS endpoints. Each test asserts that:
 * 1. The endpoint is reachable without authentication (permitAll).
 * 2. Only publicly-visible content is returned (VERIFIED / APPROVED).
 * 3. The required DTO fields are present and correctly typed.
 * 4. Admin-only fields (verificationStatus, version as internal lock, verifierId) are absent
 *    from the public surface.
 * 5. Unverified / non-approved content is excluded from listings.
 */
@SpringBootTest
@Transactional
class PublicCmsContractTest {

    @Autowired private WebApplicationContext context;
    @Autowired private ExpertRepository expertRepository;
    @Autowired private TrustDocumentRepository trustDocumentRepository;
    @Autowired private CaseStudyRepository caseStudyRepository;
    @Autowired private NewsRepository newsRepository;
    @Autowired private EcoServiceRepository ecoServiceRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private MockMvc mvc;
    private User author;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        author = createUser("cms-author-", UserRole.MANAGER);
    }

    private User createUser(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@test.kz");
        u.setPasswordHash(passwordEncoder.encode("demo123"));
        u.setName(role.name() + " User");
        u.setRole(role);
        u.setType(ClientType.staff);
        return userRepository.save(u);
    }

    // ── /api/public/content/experts ─────────────────────────────────────────────────────────────

    @Test
    void experts_list_isPubliclyReachable_returnsOnlyVerified() throws Exception {
        Expert verified = verifiedExpert("Dr. Алибек Сейткали", "Эколог");
        Expert unverified = unverifiedExpert("Неверифицированный Эксперт");

        mvc.perform(get("/api/public/content/experts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                // verified expert is in the list
                .andExpect(jsonPath("$.data[?(@.id == " + verified.getId() + ")].fullName")
                        .value("Dr. Алибек Сейткали"))
                // unverified is not in the list
                .andExpect(jsonPath("$.data[?(@.id == " + unverified.getId() + ")]").isEmpty());
    }

    @Test
    void experts_list_dtoShape_hasRequiredFields_andNoInternalAdminFields() throws Exception {
        Expert e = verifiedExpert("Профессор Айгуль Нурланова", "Химик-эколог");

        mvc.perform(get("/api/public/content/experts"))
                .andExpect(status().isOk())
                // required E-E-A-T fields
                .andExpect(jsonPath("$.data[?(@.id == " + e.getId() + ")].id").exists())
                .andExpect(jsonPath("$.data[?(@.id == " + e.getId() + ")].fullName").exists())
                .andExpect(jsonPath("$.data[?(@.id == " + e.getId() + ")].position").exists())
                .andExpect(jsonPath("$.data[?(@.id == " + e.getId() + ")].bio").exists())
                .andExpect(jsonPath("$.data[?(@.id == " + e.getId() + ")].photoUrl").exists())
                .andExpect(jsonPath("$.data[?(@.id == " + e.getId() + ")].verifiedAt").exists())
                // verificationStatus IS included in public DTO so FE can assert "VERIFIED" before
                // rendering the schema.org Person node — it will always be "VERIFIED" here
                .andExpect(jsonPath("$.data[?(@.id == " + e.getId() + ")].verificationStatus").value("VERIFIED"))
                // specializations / experienceYears / profileUrl are new E-E-A-T fields (may be null)
                .andExpect(jsonPath("$.data[?(@.id == " + e.getId() + ")].specializations").exists())
                .andExpect(jsonPath("$.data[?(@.id == " + e.getId() + ")].experienceYears").exists())
                .andExpect(jsonPath("$.data[?(@.id == " + e.getId() + ")].profileUrl").exists())
                // internal admin-only fields must NOT be present
                .andExpect(jsonPath("$.data[?(@.id == " + e.getId() + ")].version").doesNotExist())
                .andExpect(jsonPath("$.data[?(@.id == " + e.getId() + ")].verifierId").doesNotExist());
    }

    @Test
    void expert_getById_verifiedExpert_returns200WithCorrectFields() throws Exception {
        Expert e = verifiedExpert("Академик Болат Ахметов", "Токсиколог");

        mvc.perform(get("/api/public/content/experts/" + e.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(e.getId()))
                .andExpect(jsonPath("$.data.fullName").value("Академик Болат Ахметов"))
                .andExpect(jsonPath("$.data.position").value("Токсиколог"))
                .andExpect(jsonPath("$.data.verificationStatus").value("VERIFIED"))
                // internal fields absent
                .andExpect(jsonPath("$.data.version").doesNotExist())
                .andExpect(jsonPath("$.data.verifierId").doesNotExist());
    }

    @Test
    void expert_getById_unverifiedExpert_returns404() throws Exception {
        Expert e = unverifiedExpert("Секретный Эксперт");

        mvc.perform(get("/api/public/content/experts/" + e.getId()))
                .andExpect(status().isNotFound());
    }

    // ── /api/public/content/trust-documents ──────────────────────────────────────────────────────

    @Test
    void trustDocuments_list_isPubliclyReachable_returnsOnlyVerifiedNonExpired() throws Exception {
        TrustDocument valid = verifiedTrustDocument("Аккредитация ISO 17025",
                LocalDate.of(2024, 1, 1), LocalDate.of(2027, 12, 31));
        TrustDocument expired = verifiedTrustDocument("Истёкшая лицензия",
                LocalDate.of(2020, 1, 1), LocalDate.of(2023, 12, 31));
        TrustDocument unverified = unverifiedTrustDocument("Непроверенный документ");

        mvc.perform(get("/api/public/content/trust-documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[?(@.id == " + valid.getId() + ")].documentType")
                        .value("Аккредитация ISO 17025"))
                .andExpect(jsonPath("$.data[?(@.id == " + expired.getId() + ")]").isEmpty())
                .andExpect(jsonPath("$.data[?(@.id == " + unverified.getId() + ")]").isEmpty());
    }

    @Test
    void trustDocuments_list_dtoShape_hasRequiredFields_andNoAdminFields() throws Exception {
        TrustDocument d = verifiedTrustDocument("Лицензия на экологическую деятельность",
                LocalDate.of(2023, 6, 1), LocalDate.of(2028, 6, 1));

        mvc.perform(get("/api/public/content/trust-documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == " + d.getId() + ")].id").exists())
                .andExpect(jsonPath("$.data[?(@.id == " + d.getId() + ")].documentType").exists())
                .andExpect(jsonPath("$.data[?(@.id == " + d.getId() + ")].documentNumber").exists())
                .andExpect(jsonPath("$.data[?(@.id == " + d.getId() + ")].issuedBy").exists())
                .andExpect(jsonPath("$.data[?(@.id == " + d.getId() + ")].issuedAt").exists())
                .andExpect(jsonPath("$.data[?(@.id == " + d.getId() + ")].validUntil").exists())
                .andExpect(jsonPath("$.data[?(@.id == " + d.getId() + ")].sourceUrl").exists())
                // admin-only fields must NOT be present in public DTO
                .andExpect(jsonPath("$.data[?(@.id == " + d.getId() + ")].verificationStatus").doesNotExist())
                .andExpect(jsonPath("$.data[?(@.id == " + d.getId() + ")].verifiedAt").doesNotExist())
                .andExpect(jsonPath("$.data[?(@.id == " + d.getId() + ")].version").doesNotExist());
    }

    @Test
    void trustDocuments_list_noExpiry_alwaysVisible() throws Exception {
        TrustDocument perpetual = verifiedTrustDocument("Бессрочный сертификат", LocalDate.of(2022, 1, 1), null);

        mvc.perform(get("/api/public/content/trust-documents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == " + perpetual.getId() + ")].id").exists());
    }

    // ── /api/public/content/cases ────────────────────────────────────────────────────────────────

    @Test
    void cases_list_isPubliclyReachable_returnsOnlyApproved() throws Exception {
        CaseStudy approved = approvedCase("case-approved-" + System.nanoTime(), "Экологический аудит завода");
        CaseStudy draft = draftCase("case-draft-" + System.nanoTime(), "Кейс в разработке");

        mvc.perform(get("/api/public/content/cases"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[?(@.id == '" + approved.getId() + "')].title")
                        .value("Экологический аудит завода"))
                .andExpect(jsonPath("$.data[?(@.id == '" + draft.getId() + "')]").isEmpty());
    }

    @Test
    void cases_list_dtoShape_hasRequiredFields() throws Exception {
        CaseStudy c = approvedCase("case-shape-" + System.nanoTime(), "Снижение выбросов на предприятии");

        mvc.perform(get("/api/public/content/cases"))
                .andExpect(status().isOk())
                // primary fields
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].id").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].title").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].summary").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].citySlug").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].status").exists())
                // semantic aliases — same values, FE-friendly names
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].slug").value(c.getId()))
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].service").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].problem").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].workPerformed").exists())
                // classification fields
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].industry").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].objectType").exists())
                // editorial provenance for E-E-A-T
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].author").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].reviewer").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].reviewedAt").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].publishedAt").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + c.getId() + "')].results").exists());
    }

    @Test
    void cases_getBySlug_approvedCase_returns200() throws Exception {
        String slug = "case-slug-" + System.nanoTime();
        CaseStudy c = approvedCase(slug, "Утилизация отходов");

        mvc.perform(get("/api/public/content/cases/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(slug))
                .andExpect(jsonPath("$.data.slug").value(slug))
                .andExpect(jsonPath("$.data.title").value("Утилизация отходов"))
                .andExpect(jsonPath("$.data.industry").value("Горнодобывающая"))
                .andExpect(jsonPath("$.data.objectType").value("Шахта"))
                .andExpect(jsonPath("$.data.publishedAt").exists());
    }

    // ── /api/public/content/articles ─────────────────────────────────────────────────────────────

    @Test
    void articles_list_isPubliclyReachable_returnsOnlyApproved() throws Exception {
        News published = approvedNews("news-pub-" + System.nanoTime(), "Новые нормы ПДК в Алматы");
        News draft = draftNews("news-draft-" + System.nanoTime(), "Статья в разработке");

        mvc.perform(get("/api/public/content/articles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[?(@.id == '" + published.getId() + "')].title")
                        .value("Новые нормы ПДК в Алматы"))
                .andExpect(jsonPath("$.data[?(@.id == '" + draft.getId() + "')]").isEmpty());
    }

    @Test
    void articles_list_dtoShape_hasRequiredFields_includingEEAT() throws Exception {
        News n = approvedNews("news-shape-" + System.nanoTime(), "Экологический отчёт 2024");

        mvc.perform(get("/api/public/content/articles"))
                .andExpect(status().isOk())
                // base fields
                .andExpect(jsonPath("$.data[?(@.id == '" + n.getId() + "')].id").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + n.getId() + "')].title").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + n.getId() + "')].excerpt").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + n.getId() + "')].category").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + n.getId() + "')].status").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + n.getId() + "')].seo").exists())
                // E-E-A-T / Article schema fields
                .andExpect(jsonPath("$.data[?(@.id == '" + n.getId() + "')].reviewStatus").value("APPROVED"))
                .andExpect(jsonPath("$.data[?(@.id == '" + n.getId() + "')].reviewedAt").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + n.getId() + "')].author").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + n.getId() + "')].reviewer").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + n.getId() + "')].sources").exists());
    }

    @Test
    void articles_getById_approvedArticle_returns200() throws Exception {
        String slug = "article-slug-" + System.nanoTime();
        News n = approvedNews(slug, "Мониторинг воздуха");

        mvc.perform(get("/api/public/content/articles/" + slug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(slug))
                .andExpect(jsonPath("$.data.title").value("Мониторинг воздуха"));
    }

    // ── /api/public/content/services ─────────────────────────────────────────────────────────────

    @Test
    void services_list_isPubliclyReachable_returnsActiveApproved() throws Exception {
        EcoService active = activeApprovedService("Экологический аудит");
        EcoService inactive = inactiveService("Снятая с публикации услуга");

        mvc.perform(get("/api/public/content/services"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[?(@.id == '" + active.getId() + "')].title")
                        .value("Экологический аудит"))
                .andExpect(jsonPath("$.data[?(@.id == '" + inactive.getId() + "')]").isEmpty());
    }

    @Test
    void services_list_dtoShape_hasRequiredFields() throws Exception {
        EcoService s = activeApprovedService("Оценка воздействия на окружающую среду");

        mvc.perform(get("/api/public/content/services"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == '" + s.getId() + "')].id").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + s.getId() + "')].title").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + s.getId() + "')].category").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + s.getId() + "')].description").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + s.getId() + "')].status").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + s.getId() + "')].aeo").exists())
                .andExpect(jsonPath("$.data[?(@.id == '" + s.getId() + "')].seo").exists());
    }

    @Test
    void services_getById_returns200WithCorrectShape() throws Exception {
        EcoService s = activeApprovedService("Разработка ОВОС");

        mvc.perform(get("/api/public/content/services/" + s.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(s.getId()))
                .andExpect(jsonPath("$.data.title").value("Разработка ОВОС"))
                .andExpect(jsonPath("$.data.aeo").exists())
                .andExpect(jsonPath("$.data.seo").exists());
    }

    // ── Fixture helpers ──────────────────────────────────────────────────────────────────────────

    private Expert verifiedExpert(String fullName, String position) {
        Expert e = new Expert();
        e.setFullName(fullName);
        e.setPosition(position);
        e.setSpecializations("ПЭК, экологический аудит");
        e.setExperienceYears(15);
        e.setCredentials("Кандидат наук, 15 лет опыта");
        e.setBio("Специализируется в области экологического мониторинга.");
        e.setPhotoUrl("/photos/expert-" + System.nanoTime() + ".jpg");
        e.setProfileUrl("https://ecoprogress.kz/experts/" + fullName.toLowerCase().replace(" ", "-").replace(".", ""));
        e.setVerificationStatus(VerificationStatus.VERIFIED);
        e.setVerifierId(author.getId());
        e.setVerifiedAt(Instant.now());
        return expertRepository.saveAndFlush(e);
    }

    private Expert unverifiedExpert(String fullName) {
        Expert e = new Expert();
        e.setFullName(fullName);
        e.setPosition("Специалист");
        e.setVerificationStatus(VerificationStatus.UNVERIFIED);
        return expertRepository.saveAndFlush(e);
    }

    private TrustDocument verifiedTrustDocument(String type, LocalDate issuedAt, LocalDate validUntil) {
        TrustDocument d = new TrustDocument();
        d.setDocumentType(type);
        d.setDocumentNumber("KZ-" + System.nanoTime());
        d.setIssuedBy("Министерство экологии РК");
        d.setIssuedAt(issuedAt);
        d.setValidUntil(validUntil);
        d.setSourceUrl("https://gov.kz/doc/" + System.nanoTime());
        d.setVerificationStatus(VerificationStatus.VERIFIED);
        d.setVerifierId(author.getId());
        d.setVerifiedAt(Instant.now());
        return trustDocumentRepository.saveAndFlush(d);
    }

    private TrustDocument unverifiedTrustDocument(String type) {
        TrustDocument d = new TrustDocument();
        d.setDocumentType(type);
        d.setDocumentNumber("KZ-UNVERIFIED-" + System.nanoTime());
        d.setIssuedBy("Неизвестный орган");
        d.setVerificationStatus(VerificationStatus.UNVERIFIED);
        return trustDocumentRepository.saveAndFlush(d);
    }

    private CaseStudy approvedCase(String id, String title) {
        CaseStudy c = new CaseStudy();
        c.setId(id);
        c.setTitle(title);
        c.setSummary("Краткое описание кейса.");
        c.setClientLabel("Промышленное предприятие");
        c.setCitySlug("almaty");
        c.setIndustry("Горнодобывающая");
        c.setObjectType("Шахта");
        c.setChallenge("Отсутствие документации.");
        c.setSolution("Полный пакет за 2 недели.");
        c.setResults(new java.util.ArrayList<>(java.util.List.of("Разрешение получено")));
        c.setPublishedAt(LocalDate.now());
        c.setContentStatus(ContentStatus.APPROVED);
        c.setAuthorId(author.getId());
        c.setReviewerId(author.getId());
        c.setReviewedAt(Instant.now());
        return caseStudyRepository.saveAndFlush(c);
    }

    private CaseStudy draftCase(String id, String title) {
        CaseStudy c = new CaseStudy();
        c.setId(id);
        c.setTitle(title);
        c.setSummary("Черновик.");
        c.setClientLabel("Клиент");
        c.setCitySlug("nur-sultan");
        c.setChallenge("Проблема.");
        c.setSolution("Решение.");
        c.setResults(new java.util.ArrayList<>());
        c.setContentStatus(ContentStatus.DRAFT);
        c.setAuthorId(author.getId());
        return caseStudyRepository.saveAndFlush(c);
    }

    private News approvedNews(String id, String title) {
        News n = new News();
        n.setId(id);
        n.setTitle(title);
        n.setExcerpt("Краткое описание статьи.");
        n.setCategory("Экология");
        n.setPublishedAt(java.time.LocalDate.now());
        n.setContent(java.util.List.of("Основной текст статьи."));
        n.setReviewStatus(ContentStatus.APPROVED);
        n.setAuthorId(author.getId());
        n.setReviewerId(author.getId());
        n.setReviewedAt(Instant.now());
        return newsRepository.saveAndFlush(n);
    }

    private News draftNews(String id, String title) {
        News n = new News();
        n.setId(id);
        n.setTitle(title);
        n.setExcerpt("Черновик.");
        n.setCategory("Экология");
        n.setPublishedAt(java.time.LocalDate.now());
        n.setContent(java.util.List.of());
        n.setReviewStatus(ContentStatus.DRAFT);
        n.setAuthorId(author.getId());
        return newsRepository.saveAndFlush(n);
    }

    private EcoService activeApprovedService(String title) {
        EcoService s = new EcoService();
        s.setId("svc-active-" + System.nanoTime());
        s.setTitle(title);
        s.setCategory(ServiceCategory.PERMITS);
        s.setDescription("Полный экологический аудит предприятия.");
        s.setForWhom("Промышленные предприятия");
        s.setResult("Готовый пакет разрешительных документов");
        s.setDuration("2 недели");
        s.setIcon("eco-audit");
        s.setActive(true);
        s.setContentStatus(ContentStatus.APPROVED);
        s.setAuthorId(author.getId());
        s.setReviewerId(author.getId());
        s.setReviewedAt(Instant.now());
        s.setIncludes(java.util.List.of("Полевые исследования", "Лабораторные анализы"));
        s.setDocuments(java.util.List.of("Доверенность", "Данные об объекте"));
        s.setWorkflow(java.util.List.of("Заявка", "Исследование", "Отчёт"));
        return ecoServiceRepository.saveAndFlush(s);
    }

    private EcoService inactiveService(String title) {
        EcoService s = new EcoService();
        s.setId("svc-inactive-" + System.nanoTime());
        s.setTitle(title);
        s.setCategory(ServiceCategory.PERMITS);
        s.setDescription("Услуга снята с публикации.");
        s.setForWhom("—");
        s.setResult("—");
        s.setDuration("—");
        s.setIcon("removed");
        s.setActive(false);
        s.setContentStatus(ContentStatus.DRAFT);
        s.setAuthorId(author.getId());
        s.setIncludes(java.util.List.of());
        s.setDocuments(java.util.List.of());
        s.setWorkflow(java.util.List.of());
        return ecoServiceRepository.saveAndFlush(s);
    }
}
