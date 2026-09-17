package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.audit.AuditLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import static kz.eco.pek.PekScenarioSupport.as;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** POST /api/pek/programs/{id}/retemplate - explicit migration of legacy programs. */
@SpringBootTest
@Transactional
class PekProgramRetemplateApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekScenarioSupport support;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private AuditLogRepository auditLogRepository;

    private MockMvc mvc;
    private PekScenarioSupport.Tenant tenant;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        tenant = support.tenant("retemplate");
    }

    /** Makes the program look like it was authored under the 2021 edition; returns its version. */
    private long makeLegacy(Long programId, PekProgramStatus status) {
        PekProgram p = programRepository.findById(programId).orElseThrow();
        p.setRegulationCode(PekRegulationVersionService.PEK_RULES_250_2021);
        p.setRegulationVersion(PekRegulationVersionService.CURRENT);
        p.setTemplateVersion("v1-legacy");
        p.setStatus(status);
        return programRepository.saveAndFlush(p).getVersion();
    }

    @ParameterizedTest
    @EnumSource(value = PekProgramStatus.class, names = {"DRAFT", "RETURNED"})
    void editableStatuses_areRetemplated_withRevisionAndAudit(PekProgramStatus status) throws Exception {
        Long programId = support.createProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        long version = makeLegacy(programId, status);
        long revisionBefore = programRepository.findById(programId).orElseThrow().getContentRevision();

        String before = mvc.perform(get("/api/pek/programs/" + programId).with(as(tenant.maker())))
                .andReturn().getResponse().getContentAsString();
        assertEquals(true, JsonPath.read(before, "$.data.availableActions.retemplate"));
        String readinessBefore = mvc.perform(get("/api/pek/programs/" + programId + "/readiness").with(as(tenant.maker())))
                .andReturn().getResponse().getContentAsString();
        assertTrue(readinessBefore.contains("LEGACY_TEMPLATE"));

        long auditBefore = auditLogRepository.count();
        String body = mvc.perform(post("/api/pek/programs/" + programId + "/retemplate").with(as(tenant.maker()))
                        .header("If-Match", String.valueOf(version)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.regulationCode").value(PekRegulationVersionService.PEK_RULES_250_2026_59))
                .andExpect(jsonPath("$.data.templateVersion").value("v2-2026"))
                .andExpect(jsonPath("$.data.contentRevision").value(revisionBefore + 1))
                .andExpect(jsonPath("$.data.status").value(status.name()))
                .andExpect(jsonPath("$.data.availableActions.retemplate").value(false))
                .andReturn().getResponse().getContentAsString();
        assertTrue((Integer) JsonPath.read(body, "$.data.version") > version);
        assertTrue(auditLogRepository.findAll().stream().anyMatch(a -> "RETEMPLATE".equals(a.getActionType())
                && programId.equals(a.getEntityId())));
        assertTrue(auditLogRepository.count() > auditBefore);

        // After re-template readiness reflects the program's real gaps under the new form (the
        // mandatory sections are empty here) and no longer the legacy-template warning.
        mvc.perform(get("/api/pek/programs/" + programId + "/readiness").with(as(tenant.maker())))
                .andExpect(jsonPath("$.data.warnings[?(@.code == 'LEGACY_TEMPLATE')]").isEmpty())
                .andExpect(jsonPath("$.data.blockingIssues[?(@.code == 'NO_INDICATORS')]").isNotEmpty());

        // History entry is visible through the canonical program history endpoint.
        mvc.perform(get("/api/pek/programs/" + programId + "/history").with(as(tenant.maker())))
                .andExpect(jsonPath("$.data[?(@.actionType == 'RETEMPLATE')]").isNotEmpty());
    }

    @ParameterizedTest
    @EnumSource(value = PekProgramStatus.class, names = {"UNDER_REVIEW", "APPROVED", "ACTIVE", "ARCHIVED"})
    void nonEditableStatuses_areRefused_andNothingChanges(PekProgramStatus status) throws Exception {
        Long programId = support.createProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        long version = makeLegacy(programId, status);
        String before = mvc.perform(get("/api/pek/programs/" + programId).with(as(tenant.maker())))
                .andReturn().getResponse().getContentAsString();
        assertEquals(false, JsonPath.read(before, "$.data.availableActions.retemplate"));

        mvc.perform(post("/api/pek/programs/" + programId + "/retemplate").with(as(tenant.maker()))
                        .header("If-Match", String.valueOf(version)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PROGRAM_RETEMPLATE_NOT_ALLOWED"));
        PekProgram after = programRepository.findById(programId).orElseThrow();
        assertEquals("v1-legacy", after.getTemplateVersion());
        assertEquals(version, after.getVersion());
    }

    @Test
    void ifMatchIsRequired_andStaleVersionConflicts() throws Exception {
        Long programId = support.createProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        long version = makeLegacy(programId, PekProgramStatus.DRAFT);
        mvc.perform(post("/api/pek/programs/" + programId + "/retemplate").with(as(tenant.maker())))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/pek/programs/" + programId + "/retemplate").with(as(tenant.maker()))
                        .header("If-Match", String.valueOf(version + 5)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_VERSION_CONFLICT"));
        assertEquals("v1-legacy", programRepository.findById(programId).orElseThrow().getTemplateVersion());
    }

    @Test
    void alreadyCurrentProgram_isNotRetemplated() throws Exception {
        Long programId = support.createProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        mvc.perform(post("/api/pek/programs/" + programId + "/retemplate").with(as(tenant.maker()))
                        .header("If-Match", "0"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PROGRAM_TEMPLATE_CURRENT"));
    }

    @Test
    void foreignTenantAndReadOnlyRole_areForbidden() throws Exception {
        Long programId = support.createProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        long version = makeLegacy(programId, PekProgramStatus.DRAFT);
        PekScenarioSupport.Tenant other = support.tenant("foreign");
        mvc.perform(post("/api/pek/programs/" + programId + "/retemplate").with(as(other.maker()))
                        .header("If-Match", String.valueOf(version)))
                .andExpect(status().isForbidden());
        var lab = support.user("pek-lab-", kz.eco.user.UserRole.LABORATORY);
        support.membership(tenant.companyId(), lab);
        mvc.perform(post("/api/pek/programs/" + programId + "/retemplate").with(as(lab))
                        .header("If-Match", String.valueOf(version)))
                .andExpect(status().isForbidden());
    }
}
