package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;

import static kz.eco.pek.PekScenarioSupport.as;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** GET /api/pek/reports/creation-context: submissionDueDate/regulationVersion/templateVersion. */
@SpringBootTest
@Transactional
class PekReportCreationContextApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekScenarioSupport support;
    @Autowired private PekProgramRepository programRepository;

    private MockMvc mvc;
    private PekScenarioSupport.Tenant tenant;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        tenant = support.tenant("context");
    }

    private MockHttpServletRequestBuilder ctx(String periodType, int year, Integer quarter) {
        MockHttpServletRequestBuilder b = get("/api/pek/reports/creation-context")
                .param("companyId", tenant.companyId().toString())
                .param("objectId", tenant.objectId().toString())
                .param("periodType", periodType)
                .param("year", String.valueOf(year))
                .with(as(tenant.maker()));
        return quarter == null ? b : b.param("quarter", quarter.toString());
    }

    @ParameterizedTest
    @CsvSource({
            "1, 2026-01-01, 2026-03-31, 2026-05-01",
            "2, 2026-04-01, 2026-06-30, 2026-08-01",
            "3, 2026-07-01, 2026-09-30, 2026-11-01",
            "4, 2026-10-01, 2026-12-31, 2027-02-01"})
    void quarter_returnsServerDeadlineAndProgramVersions(int quarter, String start, String end, String due) throws Exception {
        Long programId = support.activeProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        mvc.perform(ctx("QUARTER", 2026, quarter))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.company.id").value(tenant.companyId()))
                .andExpect(jsonPath("$.data.object.id").value(tenant.objectId()))
                .andExpect(jsonPath("$.data.periodStart").value(start))
                .andExpect(jsonPath("$.data.periodEnd").value(end))
                .andExpect(jsonPath("$.data.submissionDueDate").value(due))
                .andExpect(jsonPath("$.data.regulationVersion").value(PekRegulationVersionService.PEK_RULES_250_2026_59))
                .andExpect(jsonPath("$.data.templateVersion").value("v2-2026"))
                .andExpect(jsonPath("$.data.selectedProgramId").value(programId))
                .andExpect(jsonPath("$.data.duplicateReportId").doesNotExist())
                .andExpect(jsonPath("$.data.blockingReasons").isEmpty());
    }

    @Test
    void annualPeriod_usesAnnualTablesDeadline() throws Exception {
        support.activeProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        mvc.perform(ctx("YEAR", 2026, null))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.periodStart").value("2026-01-01"))
                .andExpect(jsonPath("$.data.periodEnd").value("2026-12-31"))
                .andExpect(jsonPath("$.data.submissionDueDate").value("2027-03-01"))
                .andExpect(jsonPath("$.data.blockingReasons").isEmpty());
    }

    @Test
    void programBoundary_periodEndingOnValidUntilIsCovered_nextQuarterIsBlocked() throws Exception {
        support.activeProgram(mvc, tenant, "2026-04-01", "2026-09-30");
        mvc.perform(ctx("QUARTER", 2026, 3))
                .andExpect(jsonPath("$.data.blockingReasons").isEmpty());
        mvc.perform(ctx("QUARTER", 2026, 4))
                .andExpect(jsonPath("$.data.blockingReasons", hasItem(containsString("не покрывает"))));
        mvc.perform(ctx("QUARTER", 2026, 1))
                .andExpect(jsonPath("$.data.blockingReasons", hasItem(containsString("не покрывает"))));
        // create() enforces the same rule
        mvc.perform(post("/api/pek/reports").with(as(tenant.maker())).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 4}
                                """.formatted(tenant.companyId(), tenant.objectId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_PROGRAM_PERIOD_MISMATCH"));
    }

    @Test
    void noActiveProgram_nullVersionsAndDeadline_withBlocker() throws Exception {
        support.createProgram(mvc, tenant, "2026-01-01", "2026-12-31"); // DRAFT only
        mvc.perform(ctx("QUARTER", 2026, 3))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.submissionDueDate").doesNotExist())
                .andExpect(jsonPath("$.data.regulationVersion").doesNotExist())
                .andExpect(jsonPath("$.data.templateVersion").doesNotExist())
                .andExpect(jsonPath("$.data.selectedProgramId").doesNotExist())
                .andExpect(jsonPath("$.data.blockingReasons", hasItem("На объекте нет действующей программы ПЭК")));
        mvc.perform(post("/api/pek/reports").with(as(tenant.maker())).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 3}
                                """.formatted(tenant.companyId(), tenant.objectId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_ACTIVE_PROGRAM_MISSING"));
    }

    @Test
    void severalActivePrograms_blockUntilProgramIdChosen() throws Exception {
        Long first = support.activeProgram(mvc, tenant, "2026-01-01", "2026-06-30");
        // A second ACTIVE program on the same object (non-overlapping period).
        Long second = support.activeProgram(mvc, tenant, "2026-07-01", "2026-12-31");
        String body = mvc.perform(ctx("QUARTER", 2026, 3))
                .andExpect(jsonPath("$.data.selectedProgramId").doesNotExist())
                .andExpect(jsonPath("$.data.submissionDueDate").doesNotExist())
                .andExpect(jsonPath("$.data.blockingReasons", hasItem(containsString("несколько действующих"))))
                .andReturn().getResponse().getContentAsString();
        List<Object> programs = JsonPath.read(body, "$.data.programs");
        assertEquals(2, programs.size());

        mvc.perform(ctx("QUARTER", 2026, 3).param("programId", second.toString()))
                .andExpect(jsonPath("$.data.selectedProgramId").value(second))
                .andExpect(jsonPath("$.data.submissionDueDate").value("2026-11-01"))
                .andExpect(jsonPath("$.data.blockingReasons").isEmpty());
        mvc.perform(ctx("QUARTER", 2026, 3).param("programId", first.toString()))
                .andExpect(jsonPath("$.data.blockingReasons", hasItem(containsString("не покрывает"))));
    }

    @Test
    void duplicateReport_isReportedAndBlocked() throws Exception {
        support.activeProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        String created = mvc.perform(post("/api/pek/reports").with(as(tenant.maker())).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 3}
                                """.formatted(tenant.companyId(), tenant.objectId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.submissionDueDate").value("2026-11-01"))
                .andReturn().getResponse().getContentAsString();
        Long reportId = Long.valueOf(JsonPath.read(created, "$.data.id").toString());
        mvc.perform(ctx("QUARTER", 2026, 3))
                .andExpect(jsonPath("$.data.duplicateReportId").value(reportId))
                .andExpect(jsonPath("$.data.blockingReasons", hasItem("Отчёт за этот период уже создан")));
        mvc.perform(post("/api/pek/reports").with(as(tenant.maker())).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 3}
                                """.formatted(tenant.companyId(), tenant.objectId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_REPORT_DUPLICATE"));
    }

    @Test
    void foreignCompany_isForbidden_andForeignObjectIsBlocked() throws Exception {
        support.activeProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        PekScenarioSupport.Tenant other = support.tenant("other");
        // A user of another company cannot read this company's context.
        mvc.perform(get("/api/pek/reports/creation-context")
                        .param("companyId", tenant.companyId().toString())
                        .param("objectId", tenant.objectId().toString())
                        .param("periodType", "QUARTER").param("year", "2026").param("quarter", "3")
                        .with(as(other.maker())))
                .andExpect(status().isForbidden());
        // Own company + another company's object: no program/versions leak, explicit blocker.
        mvc.perform(get("/api/pek/reports/creation-context")
                        .param("companyId", other.companyId().toString())
                        .param("objectId", tenant.objectId().toString())
                        .param("periodType", "QUARTER").param("year", "2026").param("quarter", "3")
                        .with(as(other.maker())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.programs").isEmpty())
                .andExpect(jsonPath("$.data.regulationVersion").doesNotExist())
                .andExpect(jsonPath("$.data.blockingReasons",
                        hasItem("Объект не найден или не принадлежит выбранной компании")));
    }

    @Test
    void reportType_isClassifiedByBackend_quarterlyVsAnnual() throws Exception {
        support.activeProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        mvc.perform(ctx("QUARTER", 2026, 3))
                .andExpect(jsonPath("$.data.reportType").value("PEK_QUARTERLY"));
        mvc.perform(ctx("YEAR", 2026, null))
                .andExpect(jsonPath("$.data.reportType").value("PEK_TABLES_7_12_ANNUAL"));
    }

    @Test
    void reportType_isNullWithoutObject_blockingReasonsExplainWhy() throws Exception {
        PekScenarioSupport.Tenant other = support.tenant("no-object");
        mvc.perform(get("/api/pek/reports/creation-context")
                        .param("companyId", tenant.companyId().toString())
                        .param("objectId", other.objectId().toString())
                        .param("periodType", "QUARTER").param("year", "2026").param("quarter", "3")
                        .with(as(tenant.maker())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reportType").doesNotExist())
                .andExpect(jsonPath("$.data.blockingReasons").isNotEmpty());
    }

    @Test
    void draftProgram_behindCurrentEdition_appearsInProgramsRequiringUpdate_withRetemplateAction() throws Exception {
        Long draftId = support.createProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        PekProgram program = programRepository.findById(draftId).orElseThrow();
        program.setRegulationCode(PekRegulationVersionService.PEK_RULES_250_2021);
        program.setTemplateVersion("v1-legacy");
        programRepository.saveAndFlush(program);

        mvc.perform(ctx("QUARTER", 2026, 3))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.programsRequiringUpdate[0].id").value(draftId))
                .andExpect(jsonPath("$.data.programsRequiringUpdate[0].status").value("DRAFT"))
                .andExpect(jsonPath("$.data.programsRequiringUpdate[0].regulationCode")
                        .value(PekRegulationVersionService.PEK_RULES_250_2021))
                .andExpect(jsonPath("$.data.programsRequiringUpdate[0].templateVersion").value("v1-legacy"))
                .andExpect(jsonPath("$.data.programsRequiringUpdate[0].reason").isString())
                .andExpect(jsonPath("$.data.programsRequiringUpdate[0].availableActions.retemplate").value(true))
                // Item 2/6: never conflated with the ACTIVE-only "programs" list used for report creation.
                .andExpect(jsonPath("$.data.programs").isEmpty());
    }

    @Test
    void returnedProgram_behindCurrentEdition_alsoAppearsInProgramsRequiringUpdate() throws Exception {
        Long programId = support.createProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        support.fillSections(programId);
        mvc.perform(post("/api/pek/programs/" + programId + "/submit-review").with(as(tenant.maker())).header("If-Match", "0"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/pek/programs/" + programId + "/return").with(as(tenant.checker())).header("If-Match", "1")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"Доработать\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("RETURNED"));
        PekProgram program = programRepository.findById(programId).orElseThrow();
        program.setRegulationCode(PekRegulationVersionService.PEK_RULES_250_2021);
        program.setTemplateVersion("v1-legacy");
        programRepository.saveAndFlush(program);

        mvc.perform(ctx("QUARTER", 2026, 3))
                .andExpect(jsonPath("$.data.programsRequiringUpdate[0].id").value(programId))
                .andExpect(jsonPath("$.data.programsRequiringUpdate[0].status").value("RETURNED"));
    }

    @Test
    void activeProgram_neverAppearsInProgramsRequiringUpdate_evenIfBehindEdition() throws Exception {
        Long programId = support.activeProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        PekProgram program = programRepository.findById(programId).orElseThrow();
        program.setRegulationCode(PekRegulationVersionService.PEK_RULES_250_2021);
        program.setTemplateVersion("v1-legacy");
        programRepository.saveAndFlush(program);

        mvc.perform(ctx("QUARTER", 2026, 3))
                .andExpect(jsonPath("$.data.programsRequiringUpdate").isEmpty());
    }

    @Test
    void legacyTemplateProgram_returnsItsOwnVersions_neverTheCurrentOnes() throws Exception {
        Long programId = support.activeProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        PekProgram program = programRepository.findById(programId).orElseThrow();
        program.setRegulationCode(PekRegulationVersionService.PEK_RULES_250_2021);
        program.setTemplateVersion("v1-legacy");
        programRepository.saveAndFlush(program);
        mvc.perform(ctx("QUARTER", 2026, 3))
                .andExpect(jsonPath("$.data.regulationVersion").value(PekRegulationVersionService.PEK_RULES_250_2021))
                .andExpect(jsonPath("$.data.templateVersion").value("v1-legacy"))
                .andExpect(jsonPath("$.data.submissionDueDate").isString())
                .andExpect(jsonPath("$.data.warnings", hasItem(containsString("v1-legacy"))));
    }
}
