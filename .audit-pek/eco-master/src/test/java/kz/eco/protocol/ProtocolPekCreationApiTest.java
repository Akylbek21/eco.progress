package kz.eco.protocol;

import com.jayway.jsonpath.JsonPath;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.pek.PekFrequencyType;
import kz.eco.pek.PekProgramControlItem;
import kz.eco.pek.PekProgramControlItemRepository;
import kz.eco.pek.PekProgramIndicator;
import kz.eco.pek.PekProgramIndicatorRepository;
import kz.eco.pek.PekProgramMonitoring;
import kz.eco.pek.PekProgramMonitoringRepository;
import kz.eco.pek.PekProgramRepository;
import kz.eco.pek.PekProgramStatus;
import kz.eco.pek.PekReportProtocolSource;
import kz.eco.pek.PekReportProtocolSourceRepository;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Blocker 1 + 2: GET /api/protocols/creation-context and POST /api/protocols/from-pek against a
 * real Spring context and a real ПЭК programme (no mocked business logic - see
 * {@link PekProgramTestFixture}).
 */
@SpringBootTest
@Transactional
class ProtocolPekCreationApiTest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekProgramTestFixture fixtures;
    @Autowired private PekReportProtocolSourceRepository sourceRepository;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekProgramControlItemRepository controlItemRepository;
    @Autowired private PekProgramMonitoringRepository monitoringRepository;
    @Autowired private PekProgramIndicatorRepository indicatorRepository;

    private MockMvc mvc;
    private User head;
    private PekProgramTestFixture.Fixture f;
    private LocalDate date;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        head = fixtures.user("pek-create-head-", UserRole.HEAD);
        // A date inside a quarter that has not ended yet would make the fixture's status depend on
        // "today"; pin to the current quarter so DUE is deterministic, and use an explicitly past
        // quarter where OVERDUE is asserted.
        date = LocalDate.now();
        f = fixtures.standard(date.getYear(), head, PekFrequencyType.QUARTERLY, 1,
                PekProgramStatus.ACTIVE, true);
    }

    private RequestPostProcessor as(User u) {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                u, null, List.of(new SimpleGrantedAuthority("ROLE_" + u.getRole().name())));
        return authentication(auth);
    }

    private MvcResult context(User u, Long companyId, Long objectId, LocalDate d) throws Exception {
        return mvc.perform(get("/api/protocols/creation-context").with(as(u))
                        .param("companyId", String.valueOf(companyId))
                        .param("objectId", String.valueOf(objectId))
                        .param("date", d.toString()))
                .andReturn();
    }

    private String fromPekBody() {
        return fromPekBody(null);
    }

    private String fromPekBody(Long indicatorId) {
        return """
                {"companyId":%d,"objectId":%d,"pekProgramId":%d,"pekMonitoringId":%d,
                 "pekControlItemId":%d,"monitoringPointId":%d,"protocolTemplateId":"ambient_air",
                 %s"date":"%s"}
                """.formatted(f.companyId(), f.objectId(), f.programId(), f.monitoringId(),
                f.controlItemId(), f.pointId(),
                indicatorId == null ? "" : "\"programIndicatorId\":" + indicatorId + ",",
                date);
    }

    // ------------------------------------------------------------------ creation context -------

    @Test
    void creationContext_activeProgram_returnsRealRequirement() throws Exception {
        MvcResult r = context(head, f.companyId(), f.objectId(), date);
        assertEquals(200, r.getResponse().getStatus());
        String body = r.getResponse().getContentAsString();

        assertTrue((Boolean) JsonPath.read(body, "$.data.hasActiveProgram"));
        assertEquals(f.programId(), Long.valueOf(JsonPath.read(body, "$.data.program.id").toString()));
        assertEquals(1, ((List<?>) JsonPath.read(body, "$.data.requirements")).size());
        assertEquals("DUE", JsonPath.read(body, "$.data.requirements[0].status"));
        assertEquals(1, (int) JsonPath.read(body, "$.data.requirements[0].planCount"));
        assertEquals(0, (int) JsonPath.read(body, "$.data.requirements[0].completedCount"));
        assertEquals(1, (int) JsonPath.read(body, "$.data.requirements[0].missingCount"));
        assertTrue((Boolean) JsonPath.read(body, "$.data.requirements[0].canCreate"));
        assertEquals("ambient_air", JsonPath.read(body, "$.data.requirements[0].protocolTemplateId"));
        assertEquals("Источник №1", JsonPath.read(body, "$.data.requirements[0].monitoringPointName"));
        assertEquals(f.pointId(), Long.valueOf(
                JsonPath.read(body, "$.data.requirements[0].monitoringPointId").toString()));
        assertEquals("Ежеквартально", JsonPath.read(body, "$.data.requirements[0].frequency"));
        assertEquals(1, ((List<?>) JsonPath.read(body, "$.data.requirements[0].indicators")).size());
        assertEquals("не более 0.2 мг/м³",
                JsonPath.read(body, "$.data.requirements[0].indicators[0].normativeLabel"));
        assertNull(JsonPath.read(body, "$.data.requirements[0].existingDraftProtocolId"));
        int quarter = (date.getMonthValue() - 1) / 3 + 1;
        assertEquals(quarter, (int) JsonPath.read(body, "$.data.period.quarter"));
    }

    @Test
    void creationContext_noProgram_returnsHasActiveProgramFalse() throws Exception {
        Company other = fixtures.company("ТОО Без программы");
        CompanyObject obj = fixtures.object(other.getId(), "Площадка без программы");
        fixtures.membership(other.getId(), head);

        MvcResult r = context(head, other.getId(), obj.getId(), date);
        assertEquals(200, r.getResponse().getStatus());
        String body = r.getResponse().getContentAsString();
        assertFalse((Boolean) JsonPath.read(body, "$.data.hasActiveProgram"));
        assertNull(JsonPath.read(body, "$.data.program"));
        assertEquals(0, ((List<?>) JsonPath.read(body, "$.data.requirements")).size());
    }

    @Test
    void creationContext_foreignCompany_is403WithAccessDeniedCode() throws Exception {
        User outsider = fixtures.user("pek-create-outsider-", UserRole.LABORATORY);
        mvc.perform(get("/api/protocols/creation-context").with(as(outsider))
                        .param("companyId", String.valueOf(f.companyId()))
                        .param("objectId", String.valueOf(f.objectId()))
                        .param("date", date.toString()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void creationContext_objectOfAnotherCompany_isRejected() throws Exception {
        Company other = fixtures.company("ТОО Чужой объект");
        CompanyObject foreignObject = fixtures.object(other.getId(), "Чужая площадка");

        mvc.perform(get("/api/protocols/creation-context").with(as(head))
                        .param("companyId", String.valueOf(f.companyId()))
                        .param("objectId", String.valueOf(foreignObject.getId()))
                        .param("date", date.toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("OBJECT_COMPANY_MISMATCH"));
    }

    @Test
    void creationContext_configurationRequired_whenNoIndicatorsConfigured() throws Exception {
        indicatorRepository.deleteAll(
                indicatorRepository.findByControlItemIdOrderBySortOrderAsc(f.controlItemId()));

        MvcResult r = context(head, f.companyId(), f.objectId(), date);
        String body = r.getResponse().getContentAsString();
        assertEquals("CONFIGURATION_REQUIRED", JsonPath.read(body, "$.data.requirements[0].status"));
        assertFalse((Boolean) JsonPath.read(body, "$.data.requirements[0].canCreate"));
    }

    @Test
    void creationContext_notDue_whenFrequencyDoesNotFallIntoPeriod() throws Exception {
        PekProgramControlItem item = controlItemRepository.findById(f.controlItemId()).orElseThrow();
        item.setFrequencyType(PekFrequencyType.PER_EVENT);
        controlItemRepository.saveAndFlush(item);

        MvcResult r = context(head, f.companyId(), f.objectId(), date);
        assertEquals("NOT_DUE",
                JsonPath.read(r.getResponse().getContentAsString(), "$.data.requirements[0].status"));
    }

    @Test
    void creationContext_overdue_whenPeriodAlreadyEnded() throws Exception {
        // A quarter that is definitively in the past, still inside the programme's validity.
        LocalDate past = LocalDate.of(date.getYear(), 1, 15);
        PekProgramTestFixture.Fixture past2 = f;
        if (!past.isBefore(LocalDate.now().withDayOfMonth(1).minusMonths(3))) {
            // Current date is in Q1 - build the programme in the previous year instead.
            User owner = head;
            past2 = fixtures.programFor(f.companyId(), f.objectId(), date.getYear() - 1, owner,
                    PekFrequencyType.QUARTERLY, 1, PekProgramStatus.ACTIVE, true);
            past = LocalDate.of(date.getYear() - 1, 1, 15);
        }
        MvcResult r = context(head, past2.companyId(), past2.objectId(), past);
        String body = r.getResponse().getContentAsString();
        assertEquals("OVERDUE", JsonPath.read(body, "$.data.requirements[0].status"));
        assertTrue((Boolean) JsonPath.read(body, "$.data.requirements[0].canCreate"));
    }

    @Test
    void creationContext_completed_whenPlanIsFulfilled() throws Exception {
        Protocol done = createDraftAndGet();
        done.setStatus(ProtocolStatus.APPROVED);
        protocolRepository.saveAndFlush(done);

        MvcResult r = context(head, f.companyId(), f.objectId(), date);
        String body = r.getResponse().getContentAsString();
        assertEquals("COMPLETED", JsonPath.read(body, "$.data.requirements[0].status"));
        assertEquals(1, (int) JsonPath.read(body, "$.data.requirements[0].completedCount"));
        assertEquals(0, (int) JsonPath.read(body, "$.data.requirements[0].missingCount"));
        assertFalse((Boolean) JsonPath.read(body, "$.data.requirements[0].canCreate"));
    }

    @Test
    void creationContext_existingDraftIsReported() throws Exception {
        Protocol draft = createDraftAndGet();

        MvcResult r = context(head, f.companyId(), f.objectId(), date);
        String body = r.getResponse().getContentAsString();
        assertEquals(draft.getId(), Long.valueOf(
                JsonPath.read(body, "$.data.requirements[0].existingDraftProtocolId").toString()));
        assertFalse((Boolean) JsonPath.read(body, "$.data.requirements[0].canCreate"));
    }

    // ------------------------------------------------------------------ from-pek ---------------

    private Protocol createDraftAndGet() throws Exception {
        MvcResult created = mvc.perform(post("/api/protocols/from-pek").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(fromPekBody(f.indicatorId())))
                .andExpect(status().isOk())
                .andReturn();
        Long id = Long.valueOf(JsonPath.read(created.getResponse().getContentAsString(), "$.data.id").toString());
        return protocolRepository.findById(id).orElseThrow();
    }

    @Test
    void fromPek_createsRealDraftWithFullCanonicalLink() throws Exception {
        Protocol protocol = createDraftAndGet();

        assertEquals(ProtocolStatus.DRAFT, protocol.getStatus());
        assertEquals(f.companyId(), protocol.getCompanyId());
        assertEquals(f.objectId(), protocol.getObjectId());
        assertNotNull(protocol.getProtocolNumber());
        assertEquals("Источник №1", protocol.getSourceNumber());
        assertEquals("Источник №1", protocol.getSamplingLocationSnapshot(),
                "the ПЭК monitoring point must be filled in as the protocol's sampling place");
        assertEquals(f.programId(), protocol.getPekProgramId());
        assertEquals(f.controlItemId(), protocol.getPekControlItemId());

        List<PekReportProtocolSource> links =
                sourceRepository.findByProtocolIdOrderByCreatedAtAsc(protocol.getId());
        assertEquals(1, links.size(), "exactly one canonical link, no competing second model");
        PekReportProtocolSource link = links.get(0);
        assertEquals(f.programId(), link.getProgramId());
        assertEquals(f.controlItemId(), link.getControlItemId());
        assertEquals(f.pointId(), link.getMonitoringPointId());
        assertNotNull(link.getRequirementKey());
        // Blocker 2: programIndicatorId survives the round trip.
        assertEquals(f.indicatorId(), link.getProgramIndicatorId());
    }

    @Test
    void fromPek_programIndicatorIdIsExposedOnTheLinkApi() throws Exception {
        Protocol protocol = createDraftAndGet();
        mvc.perform(get("/api/protocols/" + protocol.getId() + "/pek-links").with(as(head)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].programIndicatorId").value(f.indicatorId().intValue()))
                .andExpect(jsonPath("$.data[0].controlItemId").value(f.controlItemId().intValue()));
    }

    @Test
    void fromPek_secondCallForSameRequirement_isDraftAlreadyExists() throws Exception {
        Protocol first = createDraftAndGet();

        mvc.perform(post("/api/protocols/from-pek").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(fromPekBody(f.indicatorId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROTOCOL_DRAFT_ALREADY_EXISTS"))
                .andExpect(jsonPath("$.fieldErrors.resourceId").value(String.valueOf(first.getId())));
    }

    @Test
    void fromPek_completedPlan_isRejected() throws Exception {
        Protocol done = createDraftAndGet();
        done.setStatus(ProtocolStatus.APPROVED);
        protocolRepository.saveAndFlush(done);
        // Detach the fulfilled protocol's requirement key so the duplicate check cannot mask the
        // plan check we actually want to exercise.
        PekReportProtocolSource link =
                sourceRepository.findByProtocolIdOrderByCreatedAtAsc(done.getId()).get(0);
        link.setRequirementKey(null);
        sourceRepository.saveAndFlush(link);

        mvc.perform(post("/api/protocols/from-pek").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(fromPekBody(f.indicatorId())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROTOCOL_PLAN_ALREADY_COMPLETED"));
    }

    @Test
    void fromPek_foreignCompany_is403() throws Exception {
        User outsider = fixtures.user("pek-create-outsider2-", UserRole.LABORATORY);
        mvc.perform(post("/api/protocols/from-pek").with(as(outsider))
                        .contentType(MediaType.APPLICATION_JSON).content(fromPekBody()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));
    }

    @Test
    void fromPek_inconsistentPekIds_areRejectedWithContextMismatch() throws Exception {
        // A control item from a different programme.
        PekProgramTestFixture.Fixture other = fixtures.programFor(f.companyId(), f.objectId(),
                date.getYear(), head, PekFrequencyType.QUARTERLY, 1, PekProgramStatus.ACTIVE, true);

        String body = """
                {"companyId":%d,"objectId":%d,"pekProgramId":%d,"pekMonitoringId":%d,
                 "pekControlItemId":%d,"monitoringPointId":%d,"protocolTemplateId":"ambient_air","date":"%s"}
                """.formatted(f.companyId(), f.objectId(), f.programId(), f.monitoringId(),
                other.controlItemId(), f.pointId(), date);

        mvc.perform(post("/api/protocols/from-pek").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_CONTEXT_MISMATCH"));
    }

    @Test
    void fromPek_indicatorOfAnotherControlItem_isRejected() throws Exception {
        PekProgramIndicator foreign = new PekProgramIndicator();
        foreign.setProgramId(f.programId());
        foreign.setControlItemId(f.controlItemId() + 999_999);
        foreign.setIndicatorName("Чужой показатель");
        foreign.setUnit("мг/м³");
        foreign.setNormativeValue(new BigDecimal("1"));
        indicatorRepository.saveAndFlush(foreign);

        mvc.perform(post("/api/protocols/from-pek").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(fromPekBody(foreign.getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_CONTEXT_MISMATCH"));
    }

    @Test
    void fromPek_draftProgram_isNotActive() throws Exception {
        var program = programRepository.findById(f.programId()).orElseThrow();
        program.setStatus(PekProgramStatus.DRAFT);
        programRepository.saveAndFlush(program);

        mvc.perform(post("/api/protocols/from-pek").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(fromPekBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PEK_PROGRAM_NOT_ACTIVE"));
    }

    @Test
    void fromPek_withoutIndicators_isConfigurationRequired() throws Exception {
        indicatorRepository.deleteAll(
                indicatorRepository.findByControlItemIdOrderBySortOrderAsc(f.controlItemId()));

        mvc.perform(post("/api/protocols/from-pek").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(fromPekBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFIGURATION_REQUIRED"));
    }

    @Test
    void fromPek_templateNotMatchingMonitoringDirection_isRejected() throws Exception {
        PekProgramMonitoring monitoring = monitoringRepository.findById(f.monitoringId()).orElseThrow();
        assertNotNull(monitoring);
        String body = fromPekBody().replace("\"ambient_air\"", "\"soil\"");
        mvc.perform(post("/api/protocols/from-pek").with(as(head))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PEK_CONTEXT_MISMATCH"));
    }
}
