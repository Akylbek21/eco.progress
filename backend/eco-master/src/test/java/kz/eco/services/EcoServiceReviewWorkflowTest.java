package kz.eco.services;

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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Retrofit of the eco_services catalogue onto the unified kz.eco.content.ContentStatus workflow -
 *  legacy /api/services and the unified /api/public/content/services contract must be the exact
 *  same implementation (no divergence), and only APPROVED/PUBLISHED+active services are public. */
@SpringBootTest
@Transactional
class EcoServiceReviewWorkflowTest {

    @Autowired private WebApplicationContext context;
    @Autowired private EcoServiceRepository repository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private MockMvc mvc;
    private User admin;
    private String serviceId;

    private String adminBase() {
        return "/api/admin/content/services/" + serviceId;
    }

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        admin = user("svc-admin-", UserRole.ADMIN);
        serviceId = "svc-" + System.nanoTime();
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

    private EcoService draftService() {
        EcoService s = new EcoService();
        s.setId(serviceId);
        s.setCategory(ServiceCategory.PROJECTING);
        s.setTitle("Тестовая услуга");
        s.setDescription("Описание тестовой услуги для проверки CMS-workflow.");
        s.setContentStatus(kz.eco.content.ContentStatus.DRAFT);
        return repository.save(s);
    }

    @Test
    void newlyCreatedDraftService_isExcludedFromPublicCatalogue() throws Exception {
        draftService();
        String body = mvc.perform(get("/api/services")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertFalse(body.contains(serviceId));
    }

    @Test
    void fullWorkflow_draftToPublished_becomesPubliclyVisibleOnBothLegacyAndUnifiedEndpoints() throws Exception {
        draftService();

        mvc.perform(post(adminBase() + "/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewStatus").value("IN_REVIEW"));

        mvc.perform(post(adminBase() + "/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviewer.id").value(admin.getId()));

        mvc.perform(post(adminBase() + "/publish").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.seo.robots").value("index,follow"));

        assertTrue(repository.findById(serviceId).orElseThrow().isIndexable());

        String legacy = mvc.perform(get("/api/services")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String unified = mvc.perform(get("/api/public/content/services")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(legacy.contains(serviceId));
        org.junit.jupiter.api.Assertions.assertEquals(legacy, unified);
    }

    @Test
    void publish_withStaleVersion_returns409VersionConflict() throws Exception {
        draftService();
        mvc.perform(post(adminBase() + "/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());
        mvc.perform(post(adminBase() + "/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}")).andExpect(status().isOk());

        mvc.perform(post(adminBase() + "/publish").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    @Test
    void publish_withoutApproval_isBlocked() throws Exception {
        draftService();
        mvc.perform(post(adminBase() + "/publish").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SERVICE_INVALID_TRANSITION"));
    }
}
