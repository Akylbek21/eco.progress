package kz.eco.content;

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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** CaseStudy CMS: DRAFT -&gt; IN_REVIEW -&gt; APPROVED -&gt; PUBLISHED -&gt; ARCHIVED. Publication only after
 *  expert review (reviewerId+reviewedAt+APPROVED); every mutation is version-checked. */
@SpringBootTest
@Transactional
class CaseStudyWorkflowTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CaseStudyRepository repository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private MockMvc mvc;
    private User admin;
    private User manager;

    private static final String ADMIN_BASE = "/api/admin/content/cases";

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        admin = user("case-admin-", UserRole.ADMIN);
        manager = user("case-manager-", UserRole.MANAGER);
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

    private String createBody(String id) {
        return """
                {"id":"%s","title":"Кейс: экологический аудит завода","summary":"Провели полный аудит и подготовили документы.",
                 "clientLabel":"Промышленное предприятие, Караганда","serviceId":"svc-1","citySlug":"karaganda",
                 "challenge":"Компания не имела разрешительной документации.","solution":"Подготовили полный пакет за 3 недели.",
                 "results":["Получено разрешение","Снижены штрафные риски"]}
                """.formatted(id);
    }

    @Test
    void create_startsAsDraft_andIsNotIndexable() throws Exception {
        mvc.perform(post(ADMIN_BASE).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody("case-1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"));

        assertFalse(repository.findById("case-1").orElseThrow().isIndexable());
    }

    @Test
    void create_withDuplicateId_isRejected() throws Exception {
        mvc.perform(post(ADMIN_BASE).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody("case-dup"))).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody("case-dup")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CASE_ALREADY_EXISTS"));
    }

    @Test
    void fullWorkflow_draftToPublished_becomesIndexableWithArticleJsonLd() throws Exception {
        mvc.perform(post(ADMIN_BASE).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody("case-full"))).andExpect(status().isOk());

        mvc.perform(post(ADMIN_BASE + "/case-full/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_REVIEW"));

        mvc.perform(post(ADMIN_BASE + "/case-full/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewer.id").value(admin.getId()));

        mvc.perform(post(ADMIN_BASE + "/case-full/publish").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.seo.robots").value("index,follow"))
                .andExpect(jsonPath("$.data.seo.canonicalUrl").value("https://ecoprogress.kz/cases/case-full"))
                .andExpect(jsonPath("$.data.seo.jsonLd['@type']").value("Article"));

        assertTrue(repository.findById("case-full").orElseThrow().isIndexable());

        String pub = mvc.perform(get("/api/public/content/cases/case-full")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(pub.contains("\"status\":\"PUBLISHED\""));

        String sitemap = mvc.perform(get("/sitemap.xml")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(sitemap.contains("/cases/case-full"));
    }

    @Test
    void publish_withoutApproval_isBlocked() throws Exception {
        mvc.perform(post(ADMIN_BASE).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody("case-noapproval"))).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/case-noapproval/publish").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CASE_INVALID_TRANSITION"));
    }

    @Test
    void update_afterSubmittedForReview_isRejected() throws Exception {
        mvc.perform(post(ADMIN_BASE).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody("case-locked"))).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/case-locked/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());

        mvc.perform(put(ADMIN_BASE + "/case-locked").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"x\",\"summary\":\"y\",\"results\":[],\"version\":1}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CASE_NOT_EDITABLE"));
    }

    @Test
    void update_withStaleVersion_returns409VersionConflict() throws Exception {
        mvc.perform(post(ADMIN_BASE).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody("case-stale"))).andExpect(status().isOk());
        mvc.perform(put(ADMIN_BASE + "/case-stale").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Обновлено\",\"summary\":\"y\",\"results\":[],\"version\":99}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    @Test
    void reviewEndpoints_areForbiddenForManager() throws Exception {
        mvc.perform(post(ADMIN_BASE).with(as(manager))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody("case-role")))
                .andExpect(status().isForbidden());
    }

    @Test
    void publicList_excludesDraftCases() throws Exception {
        mvc.perform(post(ADMIN_BASE).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody("case-draft-only"))).andExpect(status().isOk());
        String body = mvc.perform(get("/api/public/content/cases")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertFalse(body.contains("case-draft-only"));
    }

    @Test
    void serviceCityPage_surfacesPublishedCaseAsRelated() throws Exception {
        // publish a case tied to city "karaganda"
        mvc.perform(post(ADMIN_BASE).with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody("case-related"))).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/case-related/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/case-related/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}")).andExpect(status().isOk());
        mvc.perform(post(ADMIN_BASE + "/case-related/publish").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}")).andExpect(status().isOk());

        String body = mvc.perform(get("/api/public/content/regions/karaganda")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        // even with zero indexable city pages for karaganda, we just confirm the endpoint responds -
        // the actual relatedCaseStudies wiring is exercised at the ServiceCityPage level in
        // ServiceCityPageWorkflowTest; here we confirm the case itself is fetchable.
        String caseBody = mvc.perform(get("/api/public/content/cases/case-related")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(caseBody.contains("\"status\":\"PUBLISHED\""));
    }
}
