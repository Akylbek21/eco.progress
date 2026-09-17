package kz.eco.content;

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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Service-city ("region") SEO-review workflow on the unified kz.eco.content.ContentStatus: DRAFT
 *  -&gt; IN_REVIEW -&gt; APPROVED -&gt; PUBLISHED -&gt; ARCHIVED. Covers the exact acceptance criteria: quality
 *  gate blocks publish when unique text/local FAQ is missing, when a wrong city case form is used
 *  ("в Семей" instead of "в Семее"), or when content is near-duplicate of another city's page;
 *  approved News stays linkable, revoked pages drop out of the sitemap and go noindex; every
 *  mutation is version-checked - a stale version returns 409 VERSION_CONFLICT. */
@SpringBootTest
@Transactional
class ServiceCityPageWorkflowTest {

    @Autowired private WebApplicationContext context;
    @Autowired private ServiceCityPageRepository pageRepository;
    @Autowired private EcoServiceRepository serviceRepository;
    @Autowired private CityRepository cityRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private MockMvc mvc;
    private User admin;
    private User manager;
    private String serviceId;

    private String adminBase(String citySlug) {
        return "/api/admin/content/regions/" + serviceId + "/" + citySlug;
    }

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        admin = user("city-admin-", UserRole.ADMIN);
        manager = user("city-manager-", UserRole.MANAGER);
        serviceId = "svc-" + System.nanoTime();
        serviceRepository.save(ecoService(serviceId));
        ensureCity("semey", "Семей", "Семея", "Семею", "Семей", "Семеем", "Семее");
        ensureCity("almaty", "Алматы", "Алматы", "Алматы", "Алматы", "Алматы", "Алматы");
    }

    private void ensureCity(String slug, String nom, String gen, String dat, String acc, String ins, String prep) {
        if (cityRepository.existsById(slug)) return;
        City c = new City();
        c.setSlug(slug);
        c.setNominative(nom);
        c.setGenitive(gen);
        c.setDative(dat);
        c.setAccusative(acc);
        c.setInstrumental(ins);
        c.setPrepositional(prep);
        cityRepository.save(c);
    }

    private EcoService ecoService(String id) {
        EcoService s = new EcoService();
        s.setId(id);
        s.setCategory(ServiceCategory.PROJECTING);
        s.setTitle("Экологическая экспертиза");
        s.setDescription("Подготовка проектной документации по экологическим нормативам.");
        return s;
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

    private ServiceCityPage page(String citySlug, String regionalText, boolean withFaq) {
        ServiceCityPage p = new ServiceCityPage();
        p.setServiceId(serviceId);
        p.setCitySlug(citySlug);
        p.setRegionalBlocks(List.of(regionalText));
        if (withFaq) {
            p.setLocalFaq(List.of(new FaqItem("Сколько стоит услуга в " + citySlug + "?", "Стоимость рассчитывается индивидуально.")));
        }
        return pageRepository.save(p);
    }

    private static final String GOOD_SEMEY_TEXT =
            "Мы выполняем экологическую экспертизу в Семее с учётом требований Абайской области. "
                    + "Наши инженеры выезжают из Семея на объекты клиентов и учитывают локальную специфику "
                    + "промышленной застройки региона, а также особенности местных водных объектов и почв.";

    // ---- entity default & isIndexable() -------------------------------------------------------

    @Test
    void newPage_defaultsToDraft_andIsNotIndexable() {
        ServiceCityPage p = page("semey", GOOD_SEMEY_TEXT, true);
        assertEquals(ContentStatus.DRAFT, p.getContentStatus());
        assertFalse(p.isIndexable());
    }

    // ---- optimistic locking ---------------------------------------------------------------------

    @Test
    void submitForReview_withStaleVersion_returns409VersionConflict() throws Exception {
        page("semey", GOOD_SEMEY_TEXT, true);
        mvc.perform(post(adminBase("semey") + "/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":99}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));
    }

    // ---- quality gate: missing unique text / FAQ -----------------------------------------------

    @Test
    void approve_withoutRegionalText_isBlocked() throws Exception {
        page("semey", "", true);
        mvc.perform(post(adminBase("semey") + "/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isOk());
        mvc.perform(post(adminBase("semey") + "/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CITY_CONTENT_QUALITY_FAILED"));
    }

    @Test
    void approve_withoutLocalFaqOrCases_isBlocked() throws Exception {
        page("semey", GOOD_SEMEY_TEXT, false);
        mvc.perform(post(adminBase("semey") + "/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isOk());
        mvc.perform(post(adminBase("semey") + "/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CITY_CONTENT_QUALITY_FAILED"));
    }

    // ---- quality gate: wrong declension ---------------------------------------------------------

    @Test
    void approve_withWrongCityCaseForm_isBlocked() throws Exception {
        page("semey", "Мы оказываем экологическую услугу в Семей и регулярно выезжаем из Семей "
                + "на промышленные объекты клиентов для проведения полного цикла экспертных работ.", true);
        mvc.perform(post(adminBase("semey") + "/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isOk());
        mvc.perform(post(adminBase("semey") + "/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CITY_CONTENT_QUALITY_FAILED"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("в Семее")));
    }

    @Test
    void checkQuality_withCorrectDeclension_reportsNoIssues() throws Exception {
        page("semey", GOOD_SEMEY_TEXT, true);
        mvc.perform(post(adminBase("semey") + "/check-quality").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.contentQualityPassed").value(true))
                .andExpect(jsonPath("$.data.qualityIssues.length()").value(0));
    }

    @Test
    void indeclinableCity_almaty_neverFlaggedForCaseForm() throws Exception {
        page("almaty", "Мы оказываем экологическую экспертизу в Алматы и регулярно выезжаем из Алматы "
                + "на промышленные объекты клиентов для проведения полного цикла работ по нормативам региона.", true);
        mvc.perform(post(adminBase("almaty") + "/check-quality").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.contentQualityPassed").value(true));
    }

    // ---- quality gate: near-duplicate content across cities -------------------------------------

    @Test
    void approve_withContentNearlyIdenticalToAnotherCityPage_isBlocked() throws Exception {
        String template = "Мы выполняем экологическую экспертизу для промышленных объектов региона, "
                + "оформляем документацию и сопровождаем проверки контролирующих органов на всех этапах работы.";
        page("almaty", template, true);
        page("semey", template, true);

        mvc.perform(post(adminBase("semey") + "/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isOk());
        mvc.perform(post(adminBase("semey") + "/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CITY_CONTENT_QUALITY_FAILED"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("almaty")));
    }

    // ---- full happy path: draft -> review -> approve -> publish -> indexable --------------------

    @Test
    void fullWorkflow_draftToPublished_becomesIndexableWithCorrectSeo() throws Exception {
        page("semey", GOOD_SEMEY_TEXT, true);

        mvc.perform(post(adminBase("semey") + "/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.regionContentStatus").value("IN_REVIEW"));

        mvc.perform(post(adminBase("semey") + "/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.regionContentStatus").value("APPROVED"))
                .andExpect(jsonPath("$.data.reviewer.id").value(admin.getId()));

        mvc.perform(post(adminBase("semey") + "/publish").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.seo.robots").value("index,follow"))
                .andExpect(jsonPath("$.data.city.prepositional").value("Семее"))
                .andExpect(jsonPath("$.data.city.genitive").value("Семея"))
                .andExpect(jsonPath("$.data.version").value(3));

        assertTrue(pageRepository.findByServiceIdAndCitySlug(serviceId, "semey").orElseThrow().isIndexable());

        String sitemap = mvc.perform(get("/sitemap.xml")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(sitemap.contains("/uslugi/" + serviceId + "/semey"));
    }

    // ---- revoke drops from sitemap & becomes noindex ---------------------------------------------

    @Test
    void revokeApproval_dropsFromSitemap_andBecomesNoindex() throws Exception {
        page("semey", GOOD_SEMEY_TEXT, true);
        mvc.perform(post(adminBase("semey") + "/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());
        mvc.perform(post(adminBase("semey") + "/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}")).andExpect(status().isOk());
        mvc.perform(post(adminBase("semey") + "/publish").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}")).andExpect(status().isOk());

        mvc.perform(post(adminBase("semey") + "/revoke-approval").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Устаревшие цены\",\"version\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_REVIEW"))
                .andExpect(jsonPath("$.data.regionContentStatus").value("IN_REVIEW"))
                .andExpect(jsonPath("$.data.seo.robots").value("noindex,follow"));

        String sitemap = mvc.perform(get("/sitemap.xml")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertFalse(sitemap.contains("/uslugi/" + serviceId + "/semey"));
    }

    // ---- role gate -------------------------------------------------------------------------------

    @Test
    void reviewEndpoints_areForbiddenForManager() throws Exception {
        page("semey", GOOD_SEMEY_TEXT, true);
        mvc.perform(post(adminBase("semey") + "/submit-review").with(as(manager))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isForbidden());
    }

    // ---- public surfaces expose only indexable pages ---------------------------------------------

    @Test
    void publicList_excludesNonIndexablePages() throws Exception {
        page("semey", GOOD_SEMEY_TEXT, true);
        page("almaty", "Другой уникальный региональный текст для города Алматы, который совершенно "
                + "не повторяет формулировки, использованные на странице города Семей, ни единым предложением.", true);
        mvc.perform(post(adminBase("almaty") + "/submit-review").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}")).andExpect(status().isOk());
        mvc.perform(post(adminBase("almaty") + "/approve").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}")).andExpect(status().isOk());
        mvc.perform(post(adminBase("almaty") + "/publish").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}")).andExpect(status().isOk());

        String body = mvc.perform(get("/api/service-city/" + serviceId)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertFalse(body.contains("\"citySlug\":\"semey\""));
        assertTrue(body.contains("\"citySlug\":\"almaty\""));

        // The unified /api/public/content/regions/{citySlug} hub surfaces the same page too.
        String regionBody = mvc.perform(get("/api/public/content/regions/almaty")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(regionBody.contains("\"citySlug\":\"almaty\""));
    }

    @Test
    void publicDetail_ofUnreviewedPage_stillReturns200_butNoindex() throws Exception {
        page("semey", GOOD_SEMEY_TEXT, true);
        mvc.perform(get("/api/service-city/" + serviceId + "/semey"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.regionContentStatus").value("DRAFT"))
                .andExpect(jsonPath("$.data.seo.robots").value("noindex,follow"));
    }
}
