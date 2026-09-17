package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static kz.eco.pek.PekScenarioSupport.as;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * "Настройка ПЭК" → "Нормативная база" / "Сроки сдачи" (items 1/3/8/9/11/12 of the PEK settings
 * module fix): DB-backed regulation-version/deadline-rule config, versioning safety for already
 * stamped programs, and the global admin permission boundary.
 */
@SpringBootTest
@Transactional
class PekRegulationAdminApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekScenarioSupport support;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekRegulationVersionService regulationVersionService;

    private MockMvc mvc;
    private PekScenarioSupport.Tenant tenant;
    private User globalAdmin;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        tenant = support.tenant("regulation-admin");
        globalAdmin = support.user("pek-global-admin-", UserRole.ADMIN);
    }

    // ---------------------------------------------------------------------------------------
    // Item 12: new program is stamped from the DB-backed ACTIVE regulation edition.
    // ---------------------------------------------------------------------------------------

    @Test
    void newProgram_getsActiveRegulationVersionAndTemplateVersion() throws Exception {
        Long programId = support.activeProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        PekProgram program = programRepository.findById(programId).orElseThrow();
        PekRegulationVersion active = regulationVersionService.current();
        assertEquals(active.code(), program.getRegulationCode());
        assertEquals(active.programTemplateVersion(), program.getTemplateVersion());
    }

    // ---------------------------------------------------------------------------------------
    // Item 8: publishing a new edition never touches an already-ACTIVE program's stamp.
    // ---------------------------------------------------------------------------------------

    @Test
    void publishingNewEdition_doesNotChangeAlreadyActiveProgram() throws Exception {
        Long programId = support.activeProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        PekProgram before = programRepository.findById(programId).orElseThrow();
        String stampedCode = before.getRegulationCode();
        String stampedTemplate = before.getTemplateVersion();

        String newCode = "PEK_RULES_TEST_" + System.nanoTime();
        String createBody = """
                {"code": "%s", "title": "Тестовая редакция", "baseOrder": "Приказ №999 от 01.01.2030",
                 "effectiveFrom": "2030-01-01", "programTemplateVersion": "v3-test", "reportTemplateVersion": "v3-test"}
                """.formatted(newCode);
        MvcResult created = mvc.perform(post("/api/pek/admin/regulation/versions").with(as(globalAdmin))
                        .contentType(MediaType.APPLICATION_JSON).content(createBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"))
                .andReturn();
        Long newId = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());

        mvc.perform(post("/api/pek/admin/regulation/versions/" + newId + "/activate").with(as(globalAdmin))
                        .header("If-Match", "0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));

        assertEquals(newCode, regulationVersionService.currentCode(), "the newly activated edition is now current");

        PekProgram after = programRepository.findById(programId).orElseThrow();
        assertEquals(stampedCode, after.getRegulationCode(), "an already-ACTIVE program keeps its own stamp");
        assertEquals(stampedTemplate, after.getTemplateVersion());
        assertNotEquals(newCode, after.getRegulationCode());
    }

    @Test
    void onlyOneVersionActiveAtATime_activatingANewOneArchivesThePrevious() throws Exception {
        String codeA = "PEK_RULES_A_" + System.nanoTime();
        MvcResult created = mvc.perform(post("/api/pek/admin/regulation/versions").with(as(globalAdmin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code": "%s", "title": "Ред. A", "baseOrder": "Приказ №1", "effectiveFrom": "2031-01-01",
                                 "programTemplateVersion": "vA", "reportTemplateVersion": "vA"}
                                """.formatted(codeA)))
                .andExpect(status().isOk()).andReturn();
        Long idA = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());
        mvc.perform(post("/api/pek/admin/regulation/versions/" + idA + "/activate").with(as(globalAdmin))
                        .header("If-Match", "0")).andExpect(status().isOk());

        String activeCodeBefore = regulationVersionService.currentCode();
        assertEquals(codeA, activeCodeBefore);

        String listBody = mvc.perform(get("/api/pek/admin/regulation/versions").with(as(globalAdmin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        java.util.List<java.util.Map<String, Object>> rows = JsonPath.read(listBody, "$.data");
        long activeCount = rows.stream().filter(r -> "ACTIVE".equals(r.get("status"))).count();
        assertEquals(1, activeCount, "exactly one ACTIVE version at any time");
    }

    // ---------------------------------------------------------------------------------------
    // Item 11: validation.
    // ---------------------------------------------------------------------------------------

    @Test
    void createVersion_rejectsBlankCode() throws Exception {
        mvc.perform(post("/api/pek/admin/regulation/versions").with(as(globalAdmin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code": "", "title": "x", "baseOrder": "Приказ", "effectiveFrom": "2031-01-01",
                                 "programTemplateVersion": "v1", "reportTemplateVersion": "v1"}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createVersion_rejectsBlankTemplateVersion() throws Exception {
        mvc.perform(post("/api/pek/admin/regulation/versions").with(as(globalAdmin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code": "PEK_X_%d", "title": "x", "baseOrder": "Приказ", "effectiveFrom": "2031-01-01",
                                 "programTemplateVersion": "", "reportTemplateVersion": ""}
                                """.formatted(System.nanoTime())))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deletingVersionInUseByAProgram_isRejected() throws Exception {
        Long programId = support.activeProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        PekProgram program = programRepository.findById(programId).orElseThrow();
        String usedCode = program.getRegulationCode();
        String listBody = mvc.perform(get("/api/pek/admin/regulation/versions").with(as(globalAdmin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        java.util.List<java.util.Map<String, Object>> rows = JsonPath.read(listBody, "$.data");
        var usedRow = rows.stream().filter(r -> usedCode.equals(r.get("code"))).findFirst().orElseThrow();
        assertTrue((Boolean) usedRow.get("inUse"), "response flags it as in use");
        Long id = Long.valueOf(usedRow.get("id").toString());
        Long version = Long.valueOf(usedRow.get("version").toString());

        mvc.perform(delete("/api/pek/admin/regulation/versions/" + id).with(as(globalAdmin))
                        .header("If-Match", version.toString()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(org.hamcrest.Matchers.anyOf(
                        org.hamcrest.Matchers.is("PEK_REGULATION_IN_USE"), org.hamcrest.Matchers.is("PEK_REGULATION_DELETE_ACTIVE"))));
    }

    // ---------------------------------------------------------------------------------------
    // Item 9: only the global admin permission can write; ordinary staff (incl. company-scoped
    // HEAD who DOES have PEK_SETTINGS_EDIT for the tenant settings page) cannot.
    // ---------------------------------------------------------------------------------------

    @Test
    void ordinaryStaff_cannotWriteRegulationConfig_butCanReadIt() throws Exception {
        mvc.perform(post("/api/pek/admin/regulation/versions").with(as(tenant.maker()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code": "PEK_X_%d", "title": "x", "baseOrder": "Приказ", "effectiveFrom": "2031-01-01",
                                 "programTemplateVersion": "v1", "reportTemplateVersion": "v1"}
                                """.formatted(System.nanoTime())))
                .andExpect(status().isForbidden());

        mvc.perform(get("/api/pek/admin/regulation/versions").with(as(tenant.maker())))
                .andExpect(status().isOk());

        User labUser = support.user("pek-lab-", UserRole.LABORATORY);
        mvc.perform(get("/api/pek/admin/regulation/versions").with(as(labUser)))
                .andExpect(status().isOk());
    }

    // ---------------------------------------------------------------------------------------
    // Item 12: absence of a required deadline rule surfaces a clear configuration error, not a
    // silent null/NPE.
    // ---------------------------------------------------------------------------------------

    @Test
    void missingDeadlineRule_isAClearConfigurationError() {
        PekSubmissionDeadlineService service = new PekSubmissionDeadlineService();
        var ex = org.junit.jupiter.api.Assertions.assertThrows(kz.eco.common.exception.BadRequestException.class,
                () -> service.calculate(PekReportType.PEK_QUARTERLY, "NO_SUCH_EDITION",
                        java.time.LocalDate.of(2026, 3, 31)));
        assertTrue(ex.getMessage().contains("Не задано правило срока"), "message names the missing rule, not a stack trace");
    }

    // ---------------------------------------------------------------------------------------
    // Item 4: official table configuration.
    // ---------------------------------------------------------------------------------------

    @Test
    void officialTables_defaultToActiveEdition_andAreOrderedByDisplayOrder() throws Exception {
        String body = mvc.perform(get("/api/pek/admin/regulation/official-tables").with(as(tenant.maker())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        java.util.List<java.util.Map<String, Object>> rows = JsonPath.read(body, "$.data");
        assertTrue(rows.size() >= 9, "the seeded 9 official table types are all present");
        for (int i = 1; i < rows.size(); i++) {
            int prev = (int) rows.get(i - 1).get("displayOrder");
            int cur = (int) rows.get(i).get("displayOrder");
            assertTrue(prev <= cur, "rows come back ordered by displayOrder");
        }
    }

    @Test
    void inapplicableTable_mandatoryFlagIsMetadataOnly_neverForcedByThisConfig() throws Exception {
        // Item 7: this admin config can flip "mandatory" as a UI hint, but it must never be able to
        // switch an actual readiness check on/off - that stays in PekOfficialReportDataService.
        String body = mvc.perform(get("/api/pek/admin/regulation/official-tables").with(as(tenant.maker())))
                .andReturn().getResponse().getContentAsString();
        java.util.List<java.util.Map<String, Object>> rows = JsonPath.read(body, "$.data");
        var marine = rows.stream().filter(r -> "MARINE".equals(r.get("tableType"))).findFirst().orElseThrow();
        Long id = Long.valueOf(marine.get("id").toString());
        Long version = Long.valueOf(marine.get("version").toString());

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/pek/admin/regulation/official-tables/" + id)
                        .with(as(globalAdmin)).header("If-Match", version.toString())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"mandatory\": false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mandatory").value(false));
        // Readiness itself is untouched by this - covered separately in PekOfficialReportStructureTest,
        // which never reads this table and keeps blocking on MISSING_NORMATIVE etc. regardless.
    }

    @Test
    void ordinaryStaff_cannotEditOfficialTableConfig() throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/pek/admin/regulation/official-tables/1")
                        .with(as(tenant.maker())).header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"mandatory\": false}"))
                .andExpect(status().isForbidden());
    }

    // ---------------------------------------------------------------------------------------
    // Item 5: reference catalogs - single source, no duplicate lists.
    // ---------------------------------------------------------------------------------------

    @Test
    void referenceCatalogs_exposeTheSingleSourceEnums() throws Exception {
        mvc.perform(get("/api/pek/admin/regulation/reference-catalogs").with(as(tenant.maker())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.monitoringTypes", org.hamcrest.Matchers.hasItem(
                        org.hamcrest.Matchers.hasEntry("code", "EMISSION_SOURCE"))))
                .andExpect(jsonPath("$.data.officialTableTypes", org.hamcrest.Matchers.hasItem(
                        org.hamcrest.Matchers.hasEntry("code", "CALCULATED_EMISSIONS"))))
                .andExpect(jsonPath("$.data.reportTypes", org.hamcrest.Matchers.hasItem(
                        org.hamcrest.Matchers.hasEntry("code", "PEK_QUARTERLY"))));
    }

    // ---------------------------------------------------------------------------------------
    // Item 6: defaults - backend supplies regulationCode/templateVersion, user never picks them.
    // ---------------------------------------------------------------------------------------

    @Test
    void defaults_exposeActiveEditionWithoutRequiringManualSelection() throws Exception {
        PekRegulationVersion active = regulationVersionService.current();
        mvc.perform(get("/api/pek/admin/regulation/defaults").with(as(tenant.maker())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.regulationCode").value(active.code()))
                .andExpect(jsonPath("$.data.programTemplateVersion").value(active.programTemplateVersion()))
                .andExpect(jsonPath("$.data.defaultReportType").value("PEK_QUARTERLY"))
                .andExpect(jsonPath("$.data.officialTables").isArray());
    }
}
