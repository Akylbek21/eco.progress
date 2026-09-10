package kz.eco.news;

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

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Unified CMS SEO-review workflow: DRAFT -&gt; IN_REVIEW -&gt; APPROVED -&gt; PUBLISHED -&gt; ARCHIVED (see
 *  kz.eco.content.ContentStatus). Only APPROVED/PUBLISHED material is publicly indexable - covers
 *  the exact acceptance criteria: reviewed articles get 200/index,follow/self-canonical/sitemap
 *  inclusion/valid Article+Person JSON-LD/confirmed author+reviewer; unreviewed articles stay
 *  noindex,follow and are absent from the public list and sitemap; every mutation is
 *  version-checked (optimistic locking) - a stale version returns 409 VERSION_CONFLICT. */
@SpringBootTest
@Transactional
class NewsSeoReviewWorkflowTest {

    @Autowired private WebApplicationContext context;
    @Autowired private NewsRepository newsRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private MockMvc mvc;
    private User admin;
    private User manager;

    private static final String ADMIN_BASE = "/api/admin/content/articles";

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        admin = user("news-admin-", UserRole.ADMIN);
        manager = user("news-manager-", UserRole.MANAGER);
    }

    private User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@test.kz");
        u.setPasswordHash(passwordEncoder.encode("demo123"));
        u.setName(role.name() + " Tester");
        u.setRole(role);
        u.setType(ClientType.staff);
        return userRepository.save(u);
    }

    private RequestPostProcessor as(User u) {
        return authentication(new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name()))));
    }

    private News draftArticle(String id) {
        News n = new News();
        n.setId(id);
        n.setTitle("Заголовок " + id);
        n.setExcerpt("Краткое описание " + id);
        n.setCategory("Отчетность");
        n.setPublishedAt(LocalDate.now());
        n.setImage("/img.jpg");
        n.setContent(List.of("Первый абзац.", "Второй абзац."));
        return newsRepository.save(n);
    }

    private String body(String json) {
        return json;
    }

    // ---- entity default & isIndexable() ---------------------------------------------------

    @Test
    void newRow_defaultsToDraft_andIsNotIndexable() {
        News n = draftArticle("t-default");
        assertEquals(kz.eco.content.ContentStatus.DRAFT, n.getReviewStatus());
        assertFalse(n.isIndexable());
    }

    // ---- full happy-path transition chain --------------------------------------------------

    @Test
    void fullWorkflow_draftToPublished_succeedsAndBecomesIndexable() throws Exception {
        draftArticle("t-happy");

        mvc.perform(post(ADMIN_BASE + "/t-happy/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewStatus").value("IN_REVIEW"))
                .andExpect(jsonPath("$.data.author.id").value(admin.getId()));

        mvc.perform(post(ADMIN_BASE + "/t-happy/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewStatus").value("APPROVED"))
                .andExpect(jsonPath("$.data.reviewer.id").value(admin.getId()))
                .andExpect(jsonPath("$.data.seo.robots").value("index,follow"));

        mvc.perform(post(ADMIN_BASE + "/t-happy/publish").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewStatus").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.seo.robots").value("index,follow"))
                .andExpect(jsonPath("$.data.seo.canonicalUrl").value("https://ecoprogress.kz/news/t-happy"))
                .andExpect(jsonPath("$.data.seo.jsonLd['@type']").value("Article"))
                .andExpect(jsonPath("$.data.seo.jsonLd.author['@type']").value("Person"))
                .andExpect(jsonPath("$.data.seo.jsonLd.headline").value("Заголовок t-happy"))
                .andExpect(jsonPath("$.data.version").value(3));

        assertTrue(newsRepository.findById("t-happy").orElseThrow().isIndexable());
    }

    // ---- optimistic locking: stale version -> 409 VERSION_CONFLICT ---------------------------

    @Test
    void submitForReview_withStaleVersion_returns409VersionConflict() throws Exception {
        draftArticle("t-stale");
        mvc.perform(post(ADMIN_BASE + "/t-stale/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":99}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    @Test
    void submitForReview_withoutVersion_isRejected() throws Exception {
        draftArticle("t-noversion");
        mvc.perform(post(ADMIN_BASE + "/t-noversion/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VERSION_REQUIRED"));
    }

    // ---- invalid transitions are rejected ----------------------------------------------------

    @Test
    void approve_beforeSubmitForReview_isRejected() throws Exception {
        draftArticle("t-skip");
        mvc.perform(post(ADMIN_BASE + "/t-skip/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NEWS_INVALID_TRANSITION"));
    }

    @Test
    void publish_beforeApprove_isRejected() throws Exception {
        draftArticle("t-skip2");
        mvc.perform(post(ADMIN_BASE + "/t-skip2/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/t-skip2/publish").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NEWS_INVALID_TRANSITION"));
    }

    // ---- returnForRevision: mandatory reason, IN_REVIEW -> DRAFT -----------------------------

    @Test
    void returnForRevision_withoutReason_isRejected() throws Exception {
        draftArticle("t-return");
        mvc.perform(post(ADMIN_BASE + "/t-return/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/t-return/return-for-revision").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"  \",\"version\":1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("REASON_REQUIRED"));
    }

    @Test
    void returnForRevision_withReason_goesBackToDraft_andStaysNonIndexable() throws Exception {
        draftArticle("t-return2");
        mvc.perform(post(ADMIN_BASE + "/t-return2/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/t-return2/return-for-revision").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Нужно уточнить цифры\",\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewStatus").value("DRAFT"))
                .andExpect(jsonPath("$.data.seo.robots").value("noindex,follow"));
    }

    // ---- revokeApproval: mandatory reason, APPROVED/PUBLISHED -> IN_REVIEW, drops from sitemap -

    @Test
    void revokeApproval_afterPublish_dropsFromSitemapAndBecomesNoindex() throws Exception {
        draftArticle("t-revoke");
        mvc.perform(post(ADMIN_BASE + "/t-revoke/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/t-revoke/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}")).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/t-revoke/publish").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}")).andExpect(status().isOk());

        String sitemapBefore = mvc.perform(get("/sitemap.xml")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(sitemapBefore.contains("t-revoke"));

        mvc.perform(post(ADMIN_BASE + "/t-revoke/revoke-approval").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Устаревшие данные\",\"version\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewStatus").value("IN_REVIEW"))
                .andExpect(jsonPath("$.data.seo.robots").value("noindex,follow"))
                // reviewer is preserved as a historical record, not cleared by revocation
                .andExpect(jsonPath("$.data.reviewer.id").value(admin.getId()));

        String sitemapAfter = mvc.perform(get("/sitemap.xml")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertFalse(sitemapAfter.contains("t-revoke"));
    }

    @Test
    void revokeApproval_onDraftArticle_isRejected() throws Exception {
        draftArticle("t-revoke2");
        mvc.perform(post(ADMIN_BASE + "/t-revoke2/revoke-approval").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"x\",\"version\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NEWS_NOT_APPROVED"));
    }

    // ---- archive: only from PUBLISHED --------------------------------------------------------

    @Test
    void archive_ofPublishedArticle_succeeds_andDropsFromSitemap() throws Exception {
        draftArticle("t-archive");
        mvc.perform(post(ADMIN_BASE + "/t-archive/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/t-archive/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}")).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/t-archive/publish").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}")).andExpect(status().isOk());

        mvc.perform(post(ADMIN_BASE + "/t-archive/archive").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewStatus").value("ARCHIVED"))
                .andExpect(jsonPath("$.data.seo.robots").value("noindex,follow"));

        String sitemap = mvc.perform(get("/sitemap.xml")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertFalse(sitemap.contains("t-archive"));
    }

    // ---- role gate: MANAGER cannot drive the review workflow ----------------------------------

    @Test
    void reviewEndpoints_areForbiddenForManager() throws Exception {
        draftArticle("t-role");
        mvc.perform(post(ADMIN_BASE + "/t-role/submit-review").with(as(manager))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isForbidden());
    }

    // ---- public surfaces: list/detail/sitemap only ever expose reviewed material --------------

    @Test
    void publicList_excludesDraftAndInReview_includesApprovedAndPublished() throws Exception {
        draftArticle("t-list-draft");
        draftArticle("t-list-review");
        mvc.perform(post(ADMIN_BASE + "/t-list-review/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());
        draftArticle("t-list-approved");
        mvc.perform(post(ADMIN_BASE + "/t-list-approved/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/t-list-approved/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}")).andExpect(status().isOk());

        String body = mvc.perform(get("/api/news")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertFalse(body.contains("t-list-draft"));
        assertFalse(body.contains("t-list-review"));
        assertTrue(body.contains("t-list-approved"));

        // /api/public/content/articles is the same implementation, not a diverging one
        String unifiedBody = mvc.perform(get("/api/public/content/articles")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertEquals(body, unifiedBody);
    }

    @Test
    void publicDetail_ofUnreviewedArticle_stillReturns200_butNoindex() throws Exception {
        draftArticle("t-detail-draft");
        mvc.perform(get("/api/news/t-detail-draft"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewStatus").value("DRAFT"))
                .andExpect(jsonPath("$.data.seo.robots").value("noindex,follow"));
    }

    @Test
    void sitemap_containsOnlyApprovedAndPublished() throws Exception {
        draftArticle("t-sm-draft");
        draftArticle("t-sm-approved");
        mvc.perform(post(ADMIN_BASE + "/t-sm-approved/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/t-sm-approved/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}")).andExpect(status().isOk());

        String xml = mvc.perform(get("/sitemap.xml")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(xml.contains("https://ecoprogress.kz/news/t-sm-approved"));
        assertFalse(xml.contains("t-sm-draft"));
    }
}
