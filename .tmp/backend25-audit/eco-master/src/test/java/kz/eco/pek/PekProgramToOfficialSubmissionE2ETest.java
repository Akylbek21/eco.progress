package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolStatus;
import kz.eco.protocol.ProtocolTemplate;
import kz.eco.protocol.ProtocolTemplateRepository;
import kz.eco.user.User;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static kz.eco.pek.PekScenarioSupport.as;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Сквозной сценарий ПЭК на синтетических данных (тестовая H2 + файловое хранилище, без реальных
 * клиентов): программа DRAFT -> UNDER_REVIEW -> APPROVED -> ACTIVE разными maker/checker,
 * квартальный отчёт, сбор протоколов, plan/fact, превышение и корректирующее мероприятие,
 * официальный документ, подпись тестовой ЭЦП, официальная сдача и повторное чтение реквизитов.
 * На каждом шаге проверяются tenant isolation, availableActions, If-Match и аудит переходов.
 */
@SpringBootTest
@Transactional
class PekProgramToOfficialSubmissionE2ETest {

    @Autowired private WebApplicationContext context;
    @Autowired private PekScenarioSupport support;
    @Autowired private LaboratoryRepository laboratoryRepository;
    @Autowired private LaboratoryEmployeeRepository laboratoryEmployeeRepository;
    @Autowired private ProtocolTemplateRepository templateRepository;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportPlanFactRowRepository planFactRowRepository;
    @Autowired private PekReportExceedanceRepository exceedanceRepository;
    @Autowired private PekReportWorkflowHistoryRepository reportHistoryRepository;
    @Autowired private PekReportContentRevisionService reportContentRevisionService;
    @Autowired private PekProgramControlItemRepository controlItemRepository;

    @Test
    void programToOfficialSubmission() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        // 1. Company/object + maker/checker staff; a second tenant for isolation checks.
        PekScenarioSupport.Tenant t = support.tenant("e2e");
        PekScenarioSupport.Tenant foreign = support.tenant("e2e-foreign");
        User maker = t.maker();
        User checker = t.checker();
        checker.setIin("990101300123"); // PekTestCmsSigner test certificate owner
        User labUser = support.user("pek-e2e-lab-", UserRole.LABORATORY);
        support.membership(t.companyId(), labUser);

        // 2-4. Program with all mandatory sections (directions, control items, indicators, methods,
        // frequency, internal inspections, QA/QC, emergency procedures, responsibility).
        Long programId = support.createProgram(mvc, t, "2026-01-01", "2026-12-31");
        mvc.perform(post("/api/pek/programs/" + programId + "/submit-review").with(as(maker)).header("If-Match", "0"))
                .andExpect(status().isConflict()); // not ready yet: blocking readiness
        support.fillSections(programId);
        mvc.perform(get("/api/pek/programs/" + programId + "/readiness").with(as(maker)))
                .andExpect(jsonPath("$.data.ready").value(true))
                .andExpect(jsonPath("$.data.progressPercent").value(100));
        mvc.perform(get("/api/pek/programs/" + programId).with(as(foreign.maker())))
                .andExpect(status().isForbidden());

        // 6. DRAFT -> UNDER_REVIEW -> APPROVED -> ACTIVE, maker != checker.
        mvc.perform(post("/api/pek/programs/" + programId + "/submit-review").with(as(maker)).header("If-Match", "5"))
                .andExpect(status().isConflict()); // stale If-Match
        mvc.perform(post("/api/pek/programs/" + programId + "/submit-review").with(as(maker)).header("If-Match", "0"))
                .andExpect(status().isOk());
        String underReview = mvc.perform(get("/api/pek/programs/" + programId).with(as(maker)))
                .andReturn().getResponse().getContentAsString();
        assertEquals(false, read(underReview, "$.data.availableActions.approve"), "maker cannot approve own program");
        mvc.perform(post("/api/pek/programs/" + programId + "/approve").with(as(maker)).header("If-Match", "1"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/pek/programs/" + programId + "/approve").with(as(checker)).header("If-Match", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"));
        mvc.perform(post("/api/pek/programs/" + programId + "/activate").with(as(checker)).header("If-Match", "2"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("ACTIVE"));
        mvc.perform(get("/api/pek/programs/" + programId + "/history").with(as(maker)))
                .andExpect(jsonPath("$.data[?(@.actionType == 'SUBMIT_REVIEW')]").isNotEmpty())
                .andExpect(jsonPath("$.data[?(@.actionType == 'APPROVE')]").isNotEmpty())
                .andExpect(jsonPath("$.data[?(@.actionType == 'ACTIVATE')]").isNotEmpty());

        // 7. Quarterly report: creation-context says exactly what create() will stamp.
        mvc.perform(get("/api/pek/reports/creation-context").with(as(maker))
                        .param("companyId", t.companyId().toString()).param("objectId", t.objectId().toString())
                        .param("periodType", "QUARTER").param("year", "2026").param("quarter", "3"))
                .andExpect(jsonPath("$.data.submissionDueDate").value("2026-11-01"))
                .andExpect(jsonPath("$.data.regulationVersion").value(PekRegulationVersionService.PEK_RULES_250_2026_59))
                .andExpect(jsonPath("$.data.templateVersion").value("v2-2026"))
                .andExpect(jsonPath("$.data.blockingReasons").isEmpty());
        String reportJson = """
                {"companyId": %d, "objectId": %d, "periodType": "QUARTER", "year": 2026, "quarter": 3}
                """.formatted(t.companyId(), t.objectId());
        String created = mvc.perform(post("/api/pek/reports").with(as(maker))
                        .contentType(MediaType.APPLICATION_JSON).content(reportJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.submissionDueDate").value("2026-11-01"))
                .andReturn().getResponse().getContentAsString();
        Long reportId = Long.valueOf(read(created, "$.data.id").toString());
        mvc.perform(post("/api/pek/reports").with(as(maker)).contentType(MediaType.APPLICATION_JSON).content(reportJson))
                .andExpect(status().isConflict()); // repeated create -> duplicate
        mvc.perform(get("/api/pek/reports/" + reportId).with(as(foreign.maker())))
                .andExpect(status().isForbidden());

        // 8. Protocol collection and matching.
        Long protocolId = createFinalizedProtocol(mvc, t, labUser, "2026-08-15");
        long v = reportRepository.findById(reportId).orElseThrow().getVersion();
        mvc.perform(post("/api/pek/reports/" + reportId + "/collect").with(as(maker)).header("If-Match", String.valueOf(v + 3)))
                .andExpect(status().isConflict());
        String collected = mvc.perform(post("/api/pek/reports/" + reportId + "/collect").with(as(maker))
                        .header("If-Match", String.valueOf(v)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertEquals(1, ((Number) read(collected, "$.data.linkedProtocolCount")).intValue());
        List<Integer> linkedIds = read(
                mvc.perform(get("/api/pek/reports/" + reportId + "/protocols").with(as(maker)))
                        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(),
                "$.data[*].protocolId");
        assertTrue(linkedIds.contains(protocolId.intValue()), linkedIds.toString());

        // 9. Plan/fact complete, one exceedance with a corrective action.
        for (PekReportPlanFactRow row : planFactRowRepository.findByReportIdOrderByControlItemIdAsc(reportId)) {
            row.setActualCount(row.getPlannedCount());
            row.setMissingCount(0);
            row.setCompletionPercent(BigDecimal.valueOf(100));
            row.setStatus(PekPlanFactRowStatus.COMPLETED);
            planFactRowRepository.saveAndFlush(row);
        }
        if (planFactRowRepository.findByReportIdOrderByControlItemIdAsc(reportId).isEmpty()) {
            PekReportPlanFactRow row = new PekReportPlanFactRow();
            row.setReportId(reportId);
            row.setControlItemId(controlItemRepository.findByProgramIdOrderBySortOrderAsc(programId).get(0).getId());
            row.setProgramIndicatorId(1L);
            row.setPlannedCount(1);
            row.setActualCount(1);
            row.setMissingCount(0);
            row.setCompletionPercent(BigDecimal.valueOf(100));
            row.setStatus(PekPlanFactRowStatus.COMPLETED);
            planFactRowRepository.saveAndFlush(row);
        }
        mvc.perform(get("/api/pek/reports/" + reportId + "/plan-fact").with(as(maker))).andExpect(status().isOk());
        PekReportExceedance exceedance = new PekReportExceedance();
        exceedance.setReportId(reportId);
        exceedance.setPlanFactRowId(planFactRowRepository.findByReportIdOrderByControlItemIdAsc(reportId).get(0).getId());
        exceedance.setProtocolId(protocolId);
        exceedance.setProtocolResultId(System.nanoTime());
        exceedance.setProgramIndicatorId(1L);
        exceedance.setActualValue(BigDecimal.valueOf(0.8));
        exceedance.setNormativeValue(BigDecimal.valueOf(0.5));
        exceedance.setComparisonType(kz.eco.protocol.ComparisonType.LESS_OR_EQUAL);
        exceedance.setExceedanceRatio(BigDecimal.valueOf(1.6));
        exceedance.setSeverity(PekExceedanceSeverity.MEDIUM);
        exceedance.setStatus(PekExceedanceStatus.OPEN);
        exceedanceRepository.saveAndFlush(exceedance);
        String action = mvc.perform(post("/api/pek/exceedances/" + exceedance.getId() + "/corrective-actions").with(as(checker))
                        .header("If-Match", "0").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"Наладка пылеулавливающего оборудования\",\"dueDate\":\"2026-10-15\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String actionId = read(action, "$.data.id").toString();
        Long exceedanceId = exceedance.getId();
        for (String actionStatus : List.of("IN_PROGRESS", "DONE")) {
            mvc.perform(post("/api/pek/exceedances/" + exceedanceId + "/corrective-actions/" + actionId + "/transition")
                            .with(as(checker)).header("If-Match", String.valueOf(exceedanceVersion(exceedanceId)))
                            .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"" + actionStatus + "\"}"))
                    .andExpect(status().isOk());
        }
        mvc.perform(post("/api/pek/exceedances/" + exceedanceId + "/assign").with(as(checker))
                        .header("If-Match", String.valueOf(exceedanceVersion(exceedanceId)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"responsibleUserId\":" + maker.getId()
                                + ",\"correctiveAction\":\"Наладка пылеулавливающего оборудования\",\"dueDate\":\"2026-10-15\"}"))
                .andExpect(status().isOk());
        for (String exceedanceStatus : List.of("CONFIRMED", "RESOLVED")) {
            String transitioned = mvc.perform(post("/api/pek/exceedances/" + exceedanceId + "/transition")
                            .with(as(checker)).header("If-Match", String.valueOf(exceedanceVersion(exceedanceId)))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"status\":\"" + exceedanceStatus + "\",\"comment\":\"Мероприятие выполнено\",\"correctiveAction\":\"Наладка пылеулавливающего оборудования\",\"resolutionComment\":\"Повторный замер в норме\"}"))
                    .andReturn().getResponse().getContentAsString();
            assertEquals(exceedanceStatus, read(transitioned, "$.data.status"), transitioned);
        }
        mvc.perform(post("/api/pek/exceedances/" + exceedance.getId() + "/corrective-actions").with(as(foreign.maker()))
                        .header("If-Match", "1").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"x\"}"))
                .andExpect(status().isForbidden());

        // Report review: maker submits, checker approves.
        long rv = reportRepository.findById(reportId).orElseThrow().getVersion();
        String submittedForReview = mvc.perform(post("/api/pek/reports/" + reportId + "/submit-review").with(as(maker))
                        .header("If-Match", String.valueOf(rv)))
                .andReturn().getResponse().getContentAsString();
        assertEquals("READY_FOR_REVIEW", read(submittedForReview, "$.data.status"), submittedForReview);
        rv = reportRepository.findById(reportId).orElseThrow().getVersion();
        mvc.perform(post("/api/pek/reports/" + reportId + "/approve").with(as(maker)).header("If-Match", String.valueOf(rv)))
                .andExpect(status().isConflict()); // maker-checker
        mvc.perform(post("/api/pek/reports/" + reportId + "/approve").with(as(checker)).header("If-Match", String.valueOf(rv)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("APPROVED"));

        // 10. Current official document; a stale one cannot be signed.
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(checker)))
                .andExpect(status().isOk());
        reportContentRevisionService.bump(reportId);
        byte[] stalePdf = mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/pdf").with(as(checker)))
                .andReturn().getResponse().getContentAsByteArray();
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(checker))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + PekTestCmsSigner.signAttached(stalePdf) + "\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/generate-pdf").with(as(checker)))
                .andExpect(status().isOk());
        byte[] pdf = mvc.perform(get("/api/pek/reports/" + reportId + "/document/download/pdf").with(as(checker)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();

        // 11. Sign with the test certificate (crypto-provider stub).
        mvc.perform(post("/api/pek/reports/" + reportId + "/document/sign").with(as(checker))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cms\":\"" + PekTestCmsSigner.signAttached(pdf) + "\"}"))
                .andExpect(status().isOk());
        String signed = mvc.perform(get("/api/pek/reports/" + reportId).with(as(maker)))
                .andReturn().getResponse().getContentAsString();
        assertEquals("SIGNED", read(signed, "$.data.status"));
        assertEquals(true, read(signed, "$.data.availableActions.submit"));
        String labView = mvc.perform(get("/api/pek/reports/" + reportId).with(as(labUser)))
                .andReturn().getResponse().getContentAsString();
        assertEquals(false, read(labView, "$.data.availableActions.submit"), "LABORATORY cannot file");

        // 12. Official submission with requisites, then reopen and read them back.
        String fileId = read(mvc.perform(multipart("/api/pek/reports/" + reportId + "/submission/file")
                        .file(new MockMultipartFile("file", "receipt.pdf", "application/pdf", "%PDF-1.4\n%e2e".getBytes()))
                        .with(as(maker)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.data.fileId").toString();
        long sv = Long.parseLong(read(signed, "$.data.version").toString());
        String submitBody = """
                {"submittedAt":"%s","registrationNumber":"KZ-PEK-2026-00123","submissionMethod":"ECO_PORTAL",
                 "confirmationFileId":"%s","comment":"Принято порталом"}
                """.formatted(OffsetDateTime.now(ZoneOffset.ofHours(5)), fileId);
        mvc.perform(post("/api/pek/reports/" + reportId + "/submit").with(as(maker)).header("If-Match", "0")
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isConflict()); // If-Match=0 is stale here
        mvc.perform(post("/api/pek/reports/" + reportId + "/submit").with(as(foreign.maker())).header("If-Match", String.valueOf(sv))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/pek/reports/" + reportId + "/submit").with(as(maker)).header("If-Match", String.valueOf(sv))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"));
        mvc.perform(post("/api/pek/reports/" + reportId + "/submit").with(as(maker))
                        .header("If-Match", String.valueOf(reportRepository.findById(reportId).orElseThrow().getVersion()))
                        .contentType(MediaType.APPLICATION_JSON).content(submitBody))
                .andExpect(status().isConflict()); // repeated submit

        mvc.perform(get("/api/pek/reports/" + reportId).with(as(checker)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.submissionDueDate").value("2026-11-01"))
                .andExpect(jsonPath("$.data.submission.submissionMethod").value("ECO_PORTAL"))
                .andExpect(jsonPath("$.data.submission.registrationNumber").value("KZ-PEK-2026-00123"))
                .andExpect(jsonPath("$.data.submission.confirmationFileId").value(fileId))
                .andExpect(jsonPath("$.data.submission.submissionComment").value("Принято порталом"))
                .andExpect(jsonPath("$.data.submission.submittedAt").isString());
        mvc.perform(get("/api/pek/reports/" + reportId + "/submission/file").with(as(checker)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/pek/reports/" + reportId + "/submission/file").with(as(foreign.maker())))
                .andExpect(status().isForbidden());

        // Audit trail of report transitions.
        List<String> actions = reportHistoryRepository.findAll().stream()
                .filter(h -> reportId.equals(h.getReportId()))
                .map(PekReportWorkflowHistory::getAction)
                .toList();
        assertTrue(actions.containsAll(List.of("SIGN", "SUBMIT")), actions.toString());
        assertEquals(1, actions.stream().filter("SUBMIT"::equals).count());
    }

    private long exceedanceVersion(Long exceedanceId) {
        return exceedanceRepository.findById(exceedanceId).orElseThrow().getVersion();
    }

    private static <T> T read(String body, String path) {
        try {
            return JsonPath.read(body, path);
        } catch (RuntimeException e) {
            throw new AssertionError(path + " not found in: " + body, e);
        }
    }

    private Long createFinalizedProtocol(MockMvc mvc, PekScenarioSupport.Tenant t, User labUser, String date) throws Exception {
        Laboratory lab = new Laboratory();
        lab.setName("E2E Lab");
        lab.setLegalName("ТОО E2E Lab");
        lab.setAddress("г. Алматы");
        lab.setAccreditationNumber("KZ.E2E.001");
        lab.setAccreditationIssuedAt(LocalDate.of(2020, 1, 1));
        lab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        lab.setDirectorName("Директор");
        lab.setLaboratoryHeadName("Зав. лаб.");
        lab.setActive(true);
        laboratoryRepository.save(lab);
        LaboratoryEmployee employee = new LaboratoryEmployee();
        employee.setLaboratoryId(lab.getId());
        employee.setUserId(labUser.getId());
        employee.setFullName(labUser.getName());
        employee.setEmail(labUser.getEmail());
        employee.setRole("EXECUTOR");
        employee.setActive(true);
        laboratoryEmployeeRepository.save(employee);
        if (templateRepository.findByCode("AMBIENT_AIR_SZZ").isEmpty()) {
            ProtocolTemplate template = new ProtocolTemplate();
            template.setCode("AMBIENT_AIR_SZZ");
            template.setName("Атмосферный воздух СЗЗ");
            template.setDescription("Атмосферный воздух СЗЗ");
            template.setFormCode("PDV");
            template.setActive(true);
            templateRepository.save(template);
        }
        String json = """
                {"templateId": "ambient_air_szz", "companyId": %d, "objectId": %d,
                 "protocolDate": "%s", "sampleDate": "%s", "testingStartDate": "%s", "testingEndDate": "%s",
                 "measurementPlace": "Точка №1", "laboratoryId": %d, "executorId": %d}
                """.formatted(t.companyId(), t.objectId(), date, date, date, date, lab.getId(), employee.getId());
        String response = mvc.perform(post("/api/protocols").with(as(labUser))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        Long protocolId = Long.valueOf(read(response, "$.data.id").toString());
        // Test shortcut: full protocol approval/signing is covered by the protocol module's own tests.
        Protocol protocol = protocolRepository.findById(protocolId).orElseThrow();
        protocol.setStatus(ProtocolStatus.SIGNED);
        protocolRepository.save(protocol);
        return protocolId;
    }
}
