package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.Map;

import static kz.eco.pek.PekScenarioSupport.as;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** readinessPercent in list/detail is exactly PekProgramReadinessService#progressPercent. */
@SpringBootTest
@Transactional
class PekReadinessConsistencyApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekScenarioSupport support;
    @Autowired private PekProgramReadinessService readinessService;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekProgramMonitoringRepository monitoringRepository;
    @Autowired private PekProgramControlItemRepository controlItemRepository;

    private MockMvc mvc;
    private PekScenarioSupport.Tenant tenant;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        tenant = support.tenant("readiness");
    }

    private int[] percents(Long programId) throws Exception {
        String list = mvc.perform(get("/api/pek/programs").param("companyId", tenant.companyId().toString())
                        .with(as(tenant.maker())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<Integer> fromList = JsonPath.read(list, "$.data.items[?(@.id == " + programId + ")].readinessPercent");
        String detail = mvc.perform(get("/api/pek/programs/" + programId).with(as(tenant.maker())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String readiness = mvc.perform(get("/api/pek/programs/" + programId + "/readiness").with(as(tenant.maker())))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return new int[]{fromList.get(0), JsonPath.read(detail, "$.data.readinessPercent"),
                JsonPath.read(readiness, "$.data.progressPercent")};
    }

    private static void assertSame3(int[] p) {
        assertEquals(p[2], p[0], "list != readiness");
        assertEquals(p[2], p[1], "detail != readiness");
    }

    @Test
    void programWithEightBlockers_listDetailAndReadinessAgree() throws Exception {
        Long programId = support.createProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        String body = mvc.perform(get("/api/pek/programs/" + programId + "/readiness").with(as(tenant.maker())))
                .andReturn().getResponse().getContentAsString();
        List<Object> blocking = JsonPath.read(body, "$.data.blockingIssues");
        // name/object/period/responsible/control items are set; indicators, inspections, QA,
        // emergency, responsibility, monitoring directions are missing -> blockers.
        assertTrue(blocking.size() >= 6, body);
        int[] p = percents(programId);
        assertSame3(p);
        // support.createProgram() now fills BIN/KATO/OKED/category/designCapacity/facility info/
        // laboratory/method (module fix task 2), so only the six mandatory-section checks
        // (indicators/inspections/QA/emergency/responsibility/monitoring) remain failed: 24
        // applicable blocking checks, 6 failed -> 75%.
        assertEquals(75, p[2]);
    }

    @Test
    void exactlyEightBlockers_percentIsComputedFromApplicableChecks() throws Exception {
        Long programId = support.createProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        PekProgram program = programRepository.findById(programId).orElseThrow();
        program.setResponsibleUserId(null);
        programRepository.saveAndFlush(program);
        // responsible + indicators + inspections + QA + emergency + responsibility + monitoring = 7,
        // plus the incomplete control item below = 8.
        PekProgramControlItem item = controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId).get(0);
        item.setCode("");
        controlItemRepository.saveAndFlush(item);
        var readiness = readinessService.evaluate(programRepository.findById(programId).orElseThrow());
        assertEquals(8, readiness.blockingIssues().size(), readiness.blockingIssues().toString());
        // 24 applicable blocking checks (module fix task 2 added 12 general/facility/regulation/
        // laboratory checks on top of the previous 12; no point-bearing direction declared here),
        // 8 failed -> (24-8)/24 = 66.67% -> 67%.
        assertEquals(67, readiness.progressPercent());
        assertSame3(percents(programId));
    }

    @Test
    void fullyReadyProgram_is100Everywhere() throws Exception {
        Long programId = support.createProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        support.fillSections(programId);
        int[] p = percents(programId);
        assertSame3(p);
        assertEquals(100, p[2]);
        String detail = mvc.perform(get("/api/pek/programs/" + programId).with(as(tenant.maker())))
                .andReturn().getResponse().getContentAsString();
        assertEquals(true, JsonPath.read(detail, "$.data.availableActions.submitReview"));
    }

    @Test
    void nonApplicableDirections_doNotCapProgress() throws Exception {
        // EMISSION_SOURCE is not a point-bearing direction: no monitoring point is demanded, and the
        // points check is not even counted as applicable.
        Long programId = support.createProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        support.fillSections(programId);
        var readiness = readinessService.evaluate(programRepository.findById(programId).orElseThrow());
        assertTrue(readiness.ready());
        assertEquals(100, readiness.progressPercent());
        assertFalse(readiness.issues().stream().anyMatch(i -> "MONITORING_POINTS_REQUIRED".equals(i.code())));
        assertSame3(percents(programId));
    }

    @Test
    void batchEvaluation_equalsSingleEvaluation() throws Exception {
        Long empty = support.createProgram(mvc, tenant, "2026-01-01", "2026-12-31");
        Long ready = support.createProgram(mvc, tenant, "2027-01-01", "2027-12-31");
        support.fillSections(ready);
        List<PekProgram> programs = programRepository.findAllById(List.of(empty, ready));
        Map<Long, kz.eco.pek.dto.PekApiDtos.ReadinessResponse> batch = readinessService.evaluateAll(programs);
        for (PekProgram p : programs) {
            var single = readinessService.evaluate(p);
            assertEquals(single.progressPercent(), batch.get(p.getId()).progressPercent());
            assertEquals(single.ready(), batch.get(p.getId()).ready());
            assertEquals(single.issues(), batch.get(p.getId()).issues());
        }
    }
}
