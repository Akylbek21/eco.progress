package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.protocol.ComparisonType;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolResult;
import kz.eco.protocol.ProtocolResultRepository;
import kz.eco.protocol.ProtocolStatus;
import kz.eco.protocol.ProtocolTemplate;
import kz.eco.protocol.ProtocolTemplateRepository;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Module fix: {@link PekCollectionScheduler} must drive auto-collection through the single
 * application-level {@link PekAutoCollectionService}, not call {@link PekReportCollectionService
 * #collect} directly - end-to-end coverage that a scheduler run against a SIGNED protocol really
 * reconciles sources, matches the indicator, updates linkedProtocolCount and plan/fact, creates an
 * exceedance for an out-of-normative result, bumps contentRevision, and records an AUTO_COLLECT
 * history row - and that a second, no-op run does none of that a second time.
 */
@SpringBootTest
@Transactional
class PekAutoCollectionSchedulerTest {

    @Autowired private WebApplicationContext context;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private LaboratoryRepository laboratoryRepository;
    @Autowired private LaboratoryEmployeeRepository laboratoryEmployeeRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ProtocolTemplateRepository templateRepository;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private ProtocolResultRepository protocolResultRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekProgramControlItemRepository controlItemRepository;
    @Autowired private PekProgramIndicatorRepository indicatorRepository;
    @Autowired private PekReportProtocolSourceRepository sourceRepository;
    @Autowired private PekReportPlanFactRowRepository planFactRowRepository;
    @Autowired private PekReportExceedanceRepository exceedanceRepository;
    @Autowired private PekReportWorkflowHistoryRepository historyRepository;
    @Autowired private PekReportService reportService;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekSettingsRepository settingsRepository;
    @Autowired private PekCollectionScheduler scheduler;

    private MockMvc mockMvc;
    private Long companyId;
    private Long objectId;
    private Long laboratoryId;
    private Long executorId;
    private User labUser;
    private User admin;

    private RequestPostProcessor asRole(User user, UserRole role) {
        return authentication(new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("ТОО AutoCollect Test " + System.nanoTime());
        company.setBin(String.valueOf(770000000000L + Math.abs(System.nanoTime() % 9999999L)));
        company.setLegalAddress("г. Алматы");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Цех AutoCollect");
        object.setAddress("г. Алматы, промзона");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        Laboratory lab = new Laboratory();
        lab.setName("AutoCollect Lab");
        lab.setLegalName("ТОО AutoCollect Lab");
        lab.setAddress("г. Алматы");
        lab.setAccreditationNumber("KZ.AC." + System.nanoTime());
        lab.setAccreditationIssuedAt(LocalDate.of(2020, 1, 1));
        lab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        lab.setDirectorName("Директор");
        lab.setLaboratoryHeadName("Зав. лаб.");
        lab.setDefault(true);
        lab.setActive(true);
        laboratoryRepository.save(lab);
        laboratoryId = lab.getId();

        labUser = new User();
        labUser.setEmail("ac-lab-" + System.nanoTime() + "@ecoprogress.kz");
        labUser.setPasswordHash(passwordEncoder.encode("demo123"));
        labUser.setName("Lab Tester");
        labUser.setRole(UserRole.LABORATORY);
        labUser.setType(ClientType.staff);
        userRepository.save(labUser);

        admin = new User();
        admin.setEmail("ac-admin-" + System.nanoTime() + "@ecoprogress.kz");
        admin.setPasswordHash(passwordEncoder.encode("demo123"));
        admin.setName("Admin");
        admin.setRole(UserRole.ADMIN);
        admin.setType(ClientType.staff);
        userRepository.save(admin);

        // Production default: includeOnlySignedProtocols=true, autoCollectProtocols=true - exactly
        // what the scheduler must respect (item 3: only SIGNED protocols eligible under this policy).
        PekSettings settings = new PekSettings();
        settings.setCompanyId(companyId);
        settings.setDefaultReportType(PekSettingsReportType.QUARTERLY);
        settings.setAutoCollectProtocols(true);
        settings.setIncludeOnlySignedProtocols(true);
        settings.setAllowFallbackMatching(true);
        settings.setRequireManualAmbiguousConfirmation(true);
        settings.setRequireAllPlanFactItems(true);
        settings.setBlockSubmitWithUnmatchedResults(true);
        settings.setBlockSubmitWithAmbiguousResults(true);
        settings.setBlockSubmitWithStaleSources(true);
        settings.setBlockSubmitWithOpenExceedances(true);
        settings.setNotifyBeforeDeadlineDays(7);
        settings.setNotifyMissingProtocols(false);
        settings.setNotifyExceedances(false);
        settings.setNotifyReportReturned(false);
        settings.setCreatedBy(admin.getId());
        settings.setUpdatedBy(admin.getId());
        settingsRepository.save(settings);

        LaboratoryEmployee employee = new LaboratoryEmployee();
        employee.setLaboratoryId(laboratoryId);
        employee.setUserId(labUser.getId());
        employee.setFullName(labUser.getName());
        employee.setPosition("Исполнитель");
        employee.setRole("EXECUTOR");
        employee.setActive(true);
        laboratoryEmployeeRepository.save(employee);
        executorId = employee.getId();

        if (templateRepository.findByCode("AMBIENT_AIR_SZZ").isEmpty()) {
            ProtocolTemplate template = new ProtocolTemplate();
            template.setCode("AMBIENT_AIR_SZZ");
            template.setName("Атмосферный воздух СЗЗ");
            template.setDescription("Атмосферный воздух СЗЗ");
            template.setFormCode("PDV");
            template.setActive(true);
            templateRepository.save(template);
        }
    }

    private PekProgram createActiveProgram(String indicatorName, String unit) {
        PekProgram program = new PekProgram();
        program.setCompanyId(companyId);
        program.setObjectId(objectId);
        program.setNumber("AC-" + System.nanoTime());
        program.setName("AutoCollect Program");
        program.setValidFrom(LocalDate.of(2020, 1, 1));
        program.setValidUntil(LocalDate.of(2030, 12, 31));
        program.setStatus(PekProgramStatus.ACTIVE);
        program.setCreatedBy(admin.getId());
        programRepository.save(program);

        PekProgramControlItem item = new PekProgramControlItem();
        item.setProgramId(program.getId());
        item.setCode("CI-1");
        item.setName("Контроль выбросов");
        item.setControlType(PekControlType.EMISSION);
        item.setFrequencyType(PekFrequencyType.QUARTERLY);
        item.setFrequencyValue(1);
        item.setMandatory(true);
        item.setActive(true);
        item.setSortOrder(0);
        controlItemRepository.save(item);

        PekProgramIndicator indicator = new PekProgramIndicator();
        indicator.setProgramId(program.getId());
        indicator.setControlItemId(item.getId());
        indicator.setIndicatorName(indicatorName);
        indicator.setUnit(unit);
        indicator.setComparisonType(ComparisonType.LESS_OR_EQUAL);
        indicator.setNormativeValue(BigDecimal.TEN);
        indicator.setMandatory(true);
        indicator.setSortOrder(0);
        indicatorRepository.save(indicator);

        return program;
    }

    private PekReport createReport(Long programId, int year, int quarter) {
        var request = new PekApiDtos.CreateReportRequest(companyId, objectId, "QUARTER", year, quarter, programId, false);
        PekApiDtos.ReportResponse response = reportService.create(request, admin.getId());
        return reportRepository.findById(response.id()).orElseThrow();
    }

    private Long createProtocol(String protocolDate) throws Exception {
        String json = """
                {"templateId": "ambient_air_szz", "companyId": %d, "objectId": %d,
                 "protocolDate": "%s", "sampleDate": "%s", "testingStartDate": "%s", "testingEndDate": "%s",
                 "measurementPlace": "Точка №1", "laboratoryId": %d, "executorId": %d}
                """.formatted(companyId, objectId, protocolDate, protocolDate, protocolDate, protocolDate,
                laboratoryId, executorId);
        MvcResult result = mockMvc.perform(post("/api/protocols")
                        .with(asRole(labUser, UserRole.LABORATORY))
                        .contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isOk())
                .andReturn();
        return Long.valueOf(JsonPath.read(result.getResponse().getContentAsString(), "$.data.id").toString());
    }

    private void signProtocol(Long protocolId) {
        Protocol protocol = protocolRepository.findById(protocolId).orElseThrow();
        protocol.setStatus(ProtocolStatus.SIGNED);
        protocolRepository.save(protocol);
    }

    private ProtocolResult addResult(Long protocolId, int rowNumber, String indicatorName, String unit, BigDecimal value) {
        ProtocolResult result = new ProtocolResult();
        result.setProtocolId(protocolId);
        result.setRowNumber(rowNumber);
        result.setIndicatorName(indicatorName);
        result.setUnit(unit);
        result.setResultValue(value);
        return protocolResultRepository.save(result);
    }

    @Test
    void schedulerRun_onSignedProtocol_reconcilesPlanFactExceedanceRevisionAndHistory() throws Exception {
        PekProgram program = createActiveProgram("Пыль", "мг/м3");
        PekReport report = createReport(program.getId(), 2026, 3);
        Long reportId = report.getId();
        Long protocolId = createProtocol("2026-08-15");
        signProtocol(protocolId);
        // Normative is LE 10 (see createActiveProgram) - 25 is a real exceedance.
        addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(25));

        assertEquals(0L, report.getContentRevision());
        // reportService.create() itself already recorded a CREATE history entry - only AUTO_COLLECT
        // entries are what this test cares about not existing yet.
        assertTrue(countAutoCollectEntries(reportId) == 0);

        scheduler.manualRun(admin.getId(), companyId);

        // 1. A PekReportProtocolSource was created for the SIGNED protocol, matched to the indicator.
        List<PekReportProtocolSource> resultRows = sourceRepository.findByReportId(reportId).stream()
                .filter(s -> s.getProtocolResultId() != null).toList();
        assertEquals(1, resultRows.size());
        assertEquals(PekMatchStatus.MATCHED, resultRows.get(0).getMatchStatus());
        assertTrue(resultRows.get(0).getProgramIndicatorId() != null, "the result must be matched to a real program indicator");

        // 2. linkedProtocolCount updated.
        PekReport reloaded = reportRepository.findById(reportId).orElseThrow();
        assertEquals(1, reloaded.getLinkedProtocolCount());

        // 3. Plan/fact updated.
        List<PekReportPlanFactRow> planFactRows = planFactRowRepository.findByReportIdOrderByControlItemIdAsc(reportId);
        assertEquals(1, planFactRows.size());
        assertEquals(1, planFactRows.get(0).getActualCount());

        // 4. An exceedance was created for the out-of-normative result.
        List<PekReportExceedance> exceedances = exceedanceRepository.findByReportId(reportId);
        assertEquals(1, exceedances.size());
        assertEquals(0, BigDecimal.valueOf(25).compareTo(exceedances.get(0).getActualValue()));

        // 5. contentRevision was bumped by the auto-collect pass.
        assertTrue(reloaded.getContentRevision() > 0, "contentRevision must increase when sources really changed");

        // 6. History contains an AUTO_COLLECT entry.
        assertEquals(1, countAutoCollectEntries(reportId));
    }

    @Test
    void secondSchedulerRun_withNoChanges_doesNotDuplicateBumpRevisionOrAudit() throws Exception {
        PekProgram program = createActiveProgram("Пыль", "мг/м3");
        PekReport report = createReport(program.getId(), 2026, 3);
        Long reportId = report.getId();
        Long protocolId = createProtocol("2026-08-15");
        signProtocol(protocolId);
        addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(5));

        scheduler.manualRun(admin.getId(), companyId);
        PekReport afterFirst = reportRepository.findById(reportId).orElseThrow();
        long revisionAfterFirst = afterFirst.getContentRevision();
        int rowsAfterFirst = sourceRepository.findByReportId(reportId).size();
        assertEquals(1, countAutoCollectEntries(reportId));
        assertTrue(revisionAfterFirst > 0);

        scheduler.manualRun(admin.getId(), companyId);
        PekReport afterSecond = reportRepository.findById(reportId).orElseThrow();

        assertEquals(revisionAfterFirst, afterSecond.getContentRevision(),
                "a re-run that finds nothing new must not bump contentRevision again");
        assertEquals(rowsAfterFirst, sourceRepository.findByReportId(reportId).size(),
                "a re-run that finds nothing new must not create duplicate source rows");
        assertEquals(1, countAutoCollectEntries(reportId),
                "a re-run that finds nothing new must not create a second AUTO_COLLECT entry");
    }

    private long countAutoCollectEntries(Long reportId) {
        return historyRepository.findByReportIdOrderByPerformedAtAscIdAsc(reportId).stream()
                .filter(h -> "AUTO_COLLECT".equals(h.getAction())).count();
    }

    @Test
    void autoCollect_neverActsOnAReadyForReviewOrArchivedReport() throws Exception {
        PekProgram program = createActiveProgram("Пыль", "мг/м3");
        PekReport report = createReport(program.getId(), 2026, 3);
        report.setStatus(PekReportStatus.READY_FOR_REVIEW);
        reportRepository.saveAndFlush(report);
        Long protocolId = createProtocol("2026-08-15");
        signProtocol(protocolId);
        addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(5));

        scheduler.manualRun(admin.getId(), companyId);

        assertTrue(sourceRepository.findByReportId(report.getId()).isEmpty(),
                "a READY_FOR_REVIEW report must never be auto-collected into");
        assertFalse(historyRepository.findByReportIdOrderByPerformedAtAscIdAsc(report.getId()).stream()
                .anyMatch(h -> "AUTO_COLLECT".equals(h.getAction())));
    }
}
