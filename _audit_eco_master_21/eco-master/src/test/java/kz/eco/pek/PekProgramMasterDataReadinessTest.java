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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * "Программа ПЭК" master-data readiness: BIN/KATO/OKED/category/designCapacity(+unit)/
 * facilityInformation/productionCharacteristics/control items/indicators/monitoring points/
 * frequency/laboratory are all real blocking readiness checks (module fix), category is
 * restricted to I/II, program-level actualCapacity is gone, and the full DRAFT -&gt; ACTIVE
 * workflow (and the ACTIVE program's use for report creation) still works once everything is
 * filled in.
 */
@SpringBootTest
@Transactional
class PekProgramMasterDataReadinessTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekScenarioSupport support;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekProgramReadinessService readinessService;

    private MockMvc mvc;
    private PekScenarioSupport.Tenant tenant;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        tenant = support.tenant("masterdata");
    }

    /** Builds a DRAFT program with the given facilitySnapshot JSON fragment (may be {@code null}
     *  for none) and one EMISSION control item, optionally missing pieces the caller controls via
     *  {@code controlItemExtra}. */
    private Long createProgram(String facilitySnapshotJson, String controlItemExtra) throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "number": "ПЭК-MD-%d", "name": "Программа мастер-данных",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31", "responsibleUserId": %d
                 %s
                 , "controlItems": [
                   {"code": "CI-1", "name": "Контроль выбросов", "controlType": "EMISSION",
                    "frequencyType": "QUARTERLY", "frequencyValue": 1 %s}
                 ]}
                """.formatted(tenant.companyId(), tenant.objectId(), System.nanoTime() % 100000,
                tenant.maker().getId(),
                facilitySnapshotJson == null ? "" : ", \"facilitySnapshot\": " + facilitySnapshotJson,
                controlItemExtra == null ? "" : ", " + controlItemExtra);
        MvcResult result = mvc.perform(post("/api/pek/programs").with(as(tenant.maker()))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    private static final String FULL_SNAPSHOT = """
            {"facilityInformation": "Промплощадка, 1 источник выбросов",
             "kato": "751010000", "oked": "35111", "environmentalCategory": "II",
             "designCapacity": "120", "designCapacityUnit": "т/год",
             "productionCharacteristics": "Производство тепловой энергии"}""";

    private static final String LAB_AND_METHOD = "\"laboratoryId\": 1, \"measurementMethod\": \"Инструментальный\"";

    private String snapshotWithout(String fieldToBlank) {
        // Small, explicit fragments rather than JSON-manipulating FULL_SNAPSHOT - clearer about
        // exactly which single field is missing in each test.
        return switch (fieldToBlank) {
            case "binSnapshot" -> """
                    {"facilityInformation": "Промплощадка", "oked": "35111", "environmentalCategory": "II",
                     "designCapacity": "120", "designCapacityUnit": "т/год", "productionCharacteristics": "Пр-во"}""";
            case "kato" -> """
                    {"facilityInformation": "Промплощадка", "binSnapshot": "123456789012", "oked": "35111",
                     "environmentalCategory": "II", "designCapacity": "120", "designCapacityUnit": "т/год",
                     "productionCharacteristics": "Пр-во"}""";
            case "oked" -> """
                    {"facilityInformation": "Промплощадка", "binSnapshot": "123456789012", "kato": "751010000",
                     "environmentalCategory": "II", "designCapacity": "120", "designCapacityUnit": "т/год",
                     "productionCharacteristics": "Пр-во"}""";
            case "environmentalCategory" -> """
                    {"facilityInformation": "Промплощадка", "binSnapshot": "123456789012", "kato": "751010000",
                     "oked": "35111", "designCapacity": "120", "designCapacityUnit": "т/год",
                     "productionCharacteristics": "Пр-во"}""";
            case "designCapacity" -> """
                    {"facilityInformation": "Промплощадка", "binSnapshot": "123456789012", "kato": "751010000",
                     "oked": "35111", "environmentalCategory": "II", "productionCharacteristics": "Пр-во"}""";
            case "productionCharacteristics" -> """
                    {"facilityInformation": "Промплощадка", "binSnapshot": "123456789012", "kato": "751010000",
                     "oked": "35111", "environmentalCategory": "II",
                     "designCapacity": "120", "designCapacityUnit": "т/год"}""";
            default -> throw new IllegalArgumentException(fieldToBlank);
        };
    }

    private boolean blocked(Long programId, String code) throws Exception {
        String body = mvc.perform(get("/api/pek/programs/" + programId + "/readiness").with(as(tenant.maker())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        java.util.List<Object> matches = JsonPath.read(body, "$.data.blockingIssues[?(@.code=='" + code + "')]");
        return !matches.isEmpty();
    }

    // ---------------------------------------------------------------------------------------
    // 2-7, 9-11: individual missing-field blockers
    // ---------------------------------------------------------------------------------------

    @Test
    void missingBin_blocksReadiness() throws Exception {
        // Task 5: binSnapshot auto-fills from Company.bin when the request leaves it blank, so a
        // real create() call can't produce a BIN-less program from a company that has one. Clear
        // it directly to exercise the readiness check itself, independent of the auto-fill.
        Long id = createProgram(snapshotWithout("binSnapshot"), LAB_AND_METHOD);
        PekProgram program = programRepository.findById(id).orElseThrow();
        assertEquals(tenant.companyId(), program.getCompanyId());
        assertFalse(program.getBinSnapshot() == null || program.getBinSnapshot().isBlank(),
                "sanity check: auto-fill from Company.bin did happen");
        program.setBinSnapshot(null);
        programRepository.saveAndFlush(program);
        assertTrue(blocked(id, "BIN_REQUIRED"));
    }

    @Test
    void missingKato_blocksReadiness() throws Exception {
        Long id = createProgram(snapshotWithout("kato"), LAB_AND_METHOD);
        assertTrue(blocked(id, "KATO_REQUIRED"));
    }

    @Test
    void missingOked_blocksReadiness() throws Exception {
        Long id = createProgram(snapshotWithout("oked"), LAB_AND_METHOD);
        assertTrue(blocked(id, "OKED_REQUIRED"));
    }

    @Test
    void missingCategory_blocksReadiness() throws Exception {
        Long id = createProgram(snapshotWithout("environmentalCategory"), LAB_AND_METHOD);
        assertTrue(blocked(id, "CATEGORY_REQUIRED"));
    }

    @Test
    void missingDesignCapacity_blocksReadiness() throws Exception {
        Long id = createProgram(snapshotWithout("designCapacity"), LAB_AND_METHOD);
        assertTrue(blocked(id, "DESIGN_CAPACITY_REQUIRED"));
    }

    @Test
    void missingProductionCharacteristics_blocksReadiness() throws Exception {
        Long id = createProgram(snapshotWithout("productionCharacteristics"), LAB_AND_METHOD);
        assertTrue(blocked(id, "PRODUCTION_CHARACTERISTICS_REQUIRED"));
    }

    @Test
    void missingLaboratory_blocksReadinessForLabControlledItem() throws Exception {
        Long id = createProgram(FULL_SNAPSHOT, "\"measurementMethod\": \"Инструментальный\"");
        assertTrue(blocked(id, "LABORATORY_REQUIRED"));
    }

    @Test
    void missingControlItem_blocksReadiness() throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "number": "ПЭК-MD-%d", "name": "Без позиций",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31", "responsibleUserId": %d,
                 "facilitySnapshot": %s, "controlItems": []}
                """.formatted(tenant.companyId(), tenant.objectId(), System.nanoTime() % 100000,
                tenant.maker().getId(), FULL_SNAPSHOT);
        MvcResult result = mvc.perform(post("/api/pek/programs").with(as(tenant.maker()))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk()).andReturn();
        Long id = Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
        assertTrue(blocked(id, "NO_CONTROL_ITEMS"));
    }

    @Test
    void missingIndicator_blocksReadiness() throws Exception {
        // fillSections() adds an indicator - deliberately not called here, so NO_INDICATORS stays.
        Long id = createProgram(FULL_SNAPSHOT, LAB_AND_METHOD);
        assertTrue(blocked(id, "NO_INDICATORS"));
    }

    @Test
    void missingRequiredMonitoringPoint_blocksReadiness() throws Exception {
        Long id = createProgram(FULL_SNAPSHOT, LAB_AND_METHOD);
        support.fillSections(id); // fills indicators/inspections/QA/emergency/responsibility + an
        // EMISSION_SOURCE direction (not point-bearing) - add a point-bearing one without a point.
        var readinessFixture = context.getBean(PekProgramReadinessFixture.class);
        readinessFixture.addPointBearingDirection(id, PekMonitoringType.AMBIENT_AIR);
        var pointRepo = context.getBean(PekMonitoringPointRepository.class);
        pointRepo.findByProgramIdOrderByIdAsc(id).forEach(pointRepo::delete);
        assertTrue(blocked(id, "MONITORING_POINTS_REQUIRED"));
    }

    @Test
    void missingFrequency_blocksReadiness() throws Exception {
        String json = """
                {"companyId": %d, "objectId": %d, "number": "ПЭК-MD-%d", "name": "Без периодичности",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31", "responsibleUserId": %d,
                 "facilitySnapshot": %s,
                 "controlItems": [{"code": "CI-1", "name": "Контроль выбросов", "controlType": "EMISSION"}]}
                """.formatted(tenant.companyId(), tenant.objectId(), System.nanoTime() % 100000,
                tenant.maker().getId(), FULL_SNAPSHOT);
        MvcResult result = mvc.perform(post("/api/pek/programs").with(as(tenant.maker()))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk()).andReturn();
        Long id = Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
        assertTrue(blocked(id, "INCOMPLETE_CONTROL_ITEMS"));
    }

    // ---------------------------------------------------------------------------------------
    // 12: non-applicable section never blocks
    // ---------------------------------------------------------------------------------------

    @Test
    void nonApplicableMonitoringDirection_neverBlocksReadiness() throws Exception {
        Long id = createProgram(FULL_SNAPSHOT, LAB_AND_METHOD);
        support.fillSections(id); // declares only EMISSION_SOURCE
        var readiness = readinessService.evaluate(programRepository.findById(id).orElseThrow());
        assertTrue(readiness.ready(), readiness.blockingIssues().toString());
        assertFalse(readiness.issues().stream().anyMatch(i -> "MONITORING_POINTS_REQUIRED".equals(i.code())),
                "EMISSION_SOURCE is not point-bearing - no point requirement must ever surface for it");
    }

    // ---------------------------------------------------------------------------------------
    // 13: category III/IV rejected
    // ---------------------------------------------------------------------------------------

    @Test
    void categoryIII_isRejected_categoryIV_isRejected_categoryII_isAccepted() throws Exception {
        String bodyIII = """
                {"companyId": %d, "objectId": %d, "number": "ПЭК-CAT3-%d", "name": "III категория",
                 "validFrom": "2026-01-01", "validUntil": "2026-12-31", "responsibleUserId": %d,
                 "facilitySnapshot": {"environmentalCategory": "III"}, "controlItems": []}
                """.formatted(tenant.companyId(), tenant.objectId(), System.nanoTime() % 100000, tenant.maker().getId());
        mvc.perform(post("/api/pek/programs").with(as(tenant.maker()))
                        .contentType(MediaType.APPLICATION_JSON).content(bodyIII))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_CATEGORY_NOT_SUPPORTED"));

        String bodyIV = bodyIII.replace("III", "IV").replace("CAT3", "CAT4");
        mvc.perform(post("/api/pek/programs").with(as(tenant.maker()))
                        .contentType(MediaType.APPLICATION_JSON).content(bodyIV))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_CATEGORY_NOT_SUPPORTED"));

        Long okId = createProgram(FULL_SNAPSHOT, LAB_AND_METHOD); // "II"
        mvc.perform(get("/api/pek/programs/" + okId).with(as(tenant.maker())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.facilitySnapshot.environmentalCategory").value("II"));
    }

    // ---------------------------------------------------------------------------------------
    // 17: tenant isolation
    // ---------------------------------------------------------------------------------------

    @Test
    void foreignTenant_cannotReadProgram() throws Exception {
        Long id = createProgram(FULL_SNAPSHOT, LAB_AND_METHOD);
        PekScenarioSupport.Tenant other = support.tenant("md-foreign");
        mvc.perform(get("/api/pek/programs/" + id).with(as(other.maker())))
                .andExpect(status().isForbidden());
    }

    // ---------------------------------------------------------------------------------------
    // 18/20: full workflow with the new fields, and program used for report creation
    // ---------------------------------------------------------------------------------------

    @Test
    void readyProgram_reviewApproveActivate_thenCreatesReport() throws Exception {
        Long id = createProgram(FULL_SNAPSHOT, LAB_AND_METHOD);
        support.fillSections(id);
        mvc.perform(get("/api/pek/programs/" + id + "/readiness").with(as(tenant.maker())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ready").value(true))
                .andExpect(jsonPath("$.data.progressPercent").value(100));
        mvc.perform(get("/api/pek/programs/" + id).with(as(tenant.maker())))
                .andExpect(jsonPath("$.data.ready").value(true))
                .andExpect(jsonPath("$.data.blockingReasons").isEmpty())
                .andExpect(jsonPath("$.data.availableActions.submitReview").value(true));

        long v = support.activate(mvc, tenant, id);
        mvc.perform(get("/api/pek/programs/" + id).with(as(tenant.maker())))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));

        // 20: the ACTIVE program is usable for report creation (creation-context + create()).
        mvc.perform(get("/api/pek/reports/creation-context").with(as(tenant.maker()))
                        .param("companyId", tenant.companyId().toString())
                        .param("objectId", tenant.objectId().toString())
                        .param("periodType", "QUARTER").param("year", "2026").param("quarter", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.selectedProgramId").value(id))
                .andExpect(jsonPath("$.data.blockingReasons").isEmpty());
        mvc.perform(post("/api/pek/reports").with(as(tenant.maker())).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 2}
                                """.formatted(tenant.companyId(), tenant.objectId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.programId").value(id));
    }

    // ---------------------------------------------------------------------------------------
    // 19: actualCapacity is gone from program readiness/response
    // ---------------------------------------------------------------------------------------

    @Test
    void actualCapacity_isNoLongerPartOfProgram() throws Exception {
        Long id = createProgram(FULL_SNAPSHOT, LAB_AND_METHOD);
        String body = mvc.perform(get("/api/pek/programs/" + id).with(as(tenant.maker())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.facilitySnapshot.actualCapacity").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        assertFalse(body.contains("\"actualCapacity\""), "actualCapacity must not appear anywhere in the program response");

        // Entity-level: the Java field is gone entirely (compile-time guarantee), and DESIGN
        // capacity alone drives readiness - blank design capacity blocks regardless of anything
        // that might still live in the legacy DB column for a historical row.
        PekProgram program = programRepository.findById(id).orElseThrow();
        assertEquals("120", program.getDesignCapacity());
        assertEquals("т/год", program.getDesignCapacityUnit());
        program.setDesignCapacity(null);
        program.setDesignCapacityUnit(null);
        programRepository.saveAndFlush(program);
        var readiness = readinessService.evaluate(programRepository.findById(id).orElseThrow());
        assertTrue(readiness.blockingIssues().stream().anyMatch(i -> "DESIGN_CAPACITY_REQUIRED".equals(i.code())));
    }
}
