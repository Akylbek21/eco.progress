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

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class PekCollectMatchingAndIdempotencyTest {

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
    @Autowired private PekAutoCollectionService autoCollectionService;
    @Autowired private PekMonitoringPointRepository monitoringPointRepository;
    @Autowired private PekProgramMonitoringRepository monitoringRepository;

    private MockMvc mockMvc;
    private Long companyId, objectId, laboratoryId, executorId;
    private User labUser, admin;

    private RequestPostProcessor asRole(User user, UserRole role) {
        return authentication(new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("ТОО Matching Test " + System.nanoTime());
        company.setBin(String.valueOf(780000000000L + Math.abs(System.nanoTime() % 9999999L)));
        company.setLegalAddress("г. Алматы");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Цех Matching");
        object.setAddress("г. Алматы, промзона");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        Laboratory lab = new Laboratory();
        lab.setName("Matching Lab");
        lab.setLegalName("ТОО Matching Lab");
        lab.setAddress("г. Алматы");
        lab.setAccreditationNumber("KZ.AC.M" + System.nanoTime());
        lab.setAccreditationIssuedAt(LocalDate.of(2020, 1, 1));
        lab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        lab.setDirectorName("Директор");
        lab.setLaboratoryHeadName("Зав. лаб.");
        lab.setDefault(true);
        lab.setActive(true);
        laboratoryRepository.save(lab);
        laboratoryId = lab.getId();

        labUser = new User();
        labUser.setEmail("mt-lab-" + System.nanoTime() + "@ecoprogress.kz");
        labUser.setPasswordHash(passwordEncoder.encode("demo123"));
        labUser.setName("Lab Tester");
        labUser.setRole(UserRole.LABORATORY);
        labUser.setType(ClientType.staff);
        userRepository.save(labUser);

        admin = new User();
        admin.setEmail("mt-admin-" + System.nanoTime() + "@ecoprogress.kz");
        admin.setPasswordHash(passwordEncoder.encode("demo123"));
        admin.setName("Admin");
        admin.setRole(UserRole.ADMIN);
        admin.setType(ClientType.staff);
        userRepository.save(admin);

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

    private PekProgram createActiveProgram() {
        PekProgram program = new PekProgram();
        program.setCompanyId(companyId);
        program.setObjectId(objectId);
        program.setNumber("MT-" + System.nanoTime());
        program.setName("Matching Program");
        program.setValidFrom(LocalDate.of(2020, 1, 1));
        program.setValidUntil(LocalDate.of(2030, 12, 31));
        program.setStatus(PekProgramStatus.ACTIVE);
        program.setCreatedBy(admin.getId());
        programRepository.save(program);
        return program;
    }

    private PekProgramControlItem createControlItem(Long programId, String code, String name, Long monitoringPointId) {
        PekProgramControlItem item = new PekProgramControlItem();
        item.setProgramId(programId);
        item.setCode(code);
        item.setName(name);
        item.setControlType(PekControlType.EMISSION);
        item.setFrequencyType(PekFrequencyType.QUARTERLY);
        item.setFrequencyValue(1);
        item.setMandatory(true);
        item.setActive(true);
        item.setSortOrder(0);
        item.setMonitoringPointId(monitoringPointId);
        controlItemRepository.save(item);
        return item;
    }

    private PekProgramIndicator createIndicator(Long programId, Long controlItemId,
                                                  String name, String unit) {
        PekProgramIndicator indicator = new PekProgramIndicator();
        indicator.setProgramId(programId);
        indicator.setControlItemId(controlItemId);
        indicator.setIndicatorName(name);
        indicator.setUnit(unit);
        indicator.setComparisonType(ComparisonType.LESS_OR_EQUAL);
        indicator.setNormativeValue(BigDecimal.TEN);
        indicator.setMandatory(true);
        indicator.setSortOrder(0);
        indicatorRepository.save(indicator);
        return indicator;
    }

    private PekReport createReport(Long programId) {
        var request = new PekApiDtos.CreateReportRequest(companyId, objectId, "QUARTER", 2026, 3, programId, false);
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

    private ProtocolResult addResult(Long protocolId, int rowNumber, String indicatorName,
                                     String unit, BigDecimal value) {
        ProtocolResult result = new ProtocolResult();
        result.setProtocolId(protocolId);
        result.setRowNumber(rowNumber);
        result.setIndicatorName(indicatorName);
        result.setUnit(unit);
        result.setResultValue(value);
        return protocolResultRepository.save(result);
    }

    // --- Test D: Explicit controlItemId matching ---
    @Test
    void explicitControlItemId_matchesToCorrectIndicator() throws Exception {
        PekProgram program = createActiveProgram();
        PekProgramControlItem ci = createControlItem(program.getId(), "CI-EXPL", "Контроль", null);
        PekProgramIndicator ind = createIndicator(program.getId(), ci.getId(), "SO2", "мг/м3");
        createIndicator(program.getId(), ci.getId(), "NO2", "мг/м3");

        PekReport report = createReport(program.getId());
        Long protocolId = createProtocol("2026-08-15");

        Protocol protocol = protocolRepository.findById(protocolId).orElseThrow();
        protocol.setStatus(ProtocolStatus.SIGNED);
        protocol.setPekControlItemId(ci.getId());
        protocolRepository.save(protocol);

        addResult(protocolId, 1, "SO2", "мг/м3", BigDecimal.valueOf(5));

        autoCollectionService.collectWithChangeDetection(report, admin.getId(), "COLLECT");

        List<PekReportProtocolSource> resultRows = sourceRepository.findByReportId(report.getId()).stream()
                .filter(s -> s.getProtocolResultId() != null).toList();
        assertEquals(1, resultRows.size());
        assertEquals(PekMatchStatus.MATCHED, resultRows.get(0).getMatchStatus());
        assertEquals(ind.getId(), resultRows.get(0).getProgramIndicatorId());
    }

    // --- Test E: controlItem + monitoringPoint ---
    @Test
    void monitoringPointId_matchesViaControlItem() throws Exception {
        PekProgram program = createActiveProgram();

        PekProgramMonitoring monitoring = new PekProgramMonitoring();
        monitoring.setProgramId(program.getId());
        monitoring.setMonitoringType(PekMonitoringType.AMBIENT_AIR);
        monitoring.setActive(true);
        monitoringRepository.save(monitoring);

        PekMonitoringPoint point = new PekMonitoringPoint();
        point.setMonitoringId(monitoring.getId());
        point.setProgramId(program.getId());
        point.setName("Точка №1");
        monitoringPointRepository.save(point);

        PekProgramControlItem ci = createControlItem(program.getId(), "CI-MP", "Контроль СЗЗ", point.getId());
        PekProgramIndicator ind = createIndicator(program.getId(), ci.getId(), "Пыль", "мг/м3");

        PekReport report = createReport(program.getId());
        Long protocolId = createProtocol("2026-08-15");
        signProtocol(protocolId);

        ProtocolResult pr = addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(3));
        pr.setSamplingPointId(point.getId());
        protocolResultRepository.save(pr);

        autoCollectionService.collectWithChangeDetection(report, admin.getId(), "COLLECT");

        List<PekReportProtocolSource> resultRows = sourceRepository.findByReportId(report.getId()).stream()
                .filter(s -> s.getProtocolResultId() != null).toList();
        assertEquals(1, resultRows.size());
        assertEquals(PekMatchStatus.MATCHED, resultRows.get(0).getMatchStatus());
        assertEquals(ind.getId(), resultRows.get(0).getProgramIndicatorId());
    }

    // --- Test F: name+unit fallback matching ---
    @Test
    void nameAndUnitFallback_matchesWhenNoExplicitLink() throws Exception {
        PekProgram program = createActiveProgram();
        PekProgramControlItem ci = createControlItem(program.getId(), "CI-FB", "Контроль", null);
        PekProgramIndicator ind = createIndicator(program.getId(), ci.getId(), "Пыль", "мг/м3");

        PekReport report = createReport(program.getId());
        Long protocolId = createProtocol("2026-08-15");
        signProtocol(protocolId);
        addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(5));

        autoCollectionService.collectWithChangeDetection(report, admin.getId(), "COLLECT");

        List<PekReportProtocolSource> resultRows = sourceRepository.findByReportId(report.getId()).stream()
                .filter(s -> s.getProtocolResultId() != null).toList();
        assertEquals(1, resultRows.size());
        assertEquals(PekMatchStatus.MATCHED, resultRows.get(0).getMatchStatus());
        assertEquals(ind.getId(), resultRows.get(0).getProgramIndicatorId());
    }

    // --- Test G: Ambiguous - two identical candidates ---
    @Test
    void twoCandidates_resultsInAmbiguous() throws Exception {
        PekProgram program = createActiveProgram();
        PekProgramControlItem ci1 = createControlItem(program.getId(), "CI-A1", "Контроль 1", null);
        PekProgramControlItem ci2 = createControlItem(program.getId(), "CI-A2", "Контроль 2", null);
        createIndicator(program.getId(), ci1.getId(), "Пыль", "мг/м3");
        createIndicator(program.getId(), ci2.getId(), "Пыль", "мг/м3");

        PekReport report = createReport(program.getId());
        Long protocolId = createProtocol("2026-08-15");
        signProtocol(protocolId);
        addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(5));

        autoCollectionService.collectWithChangeDetection(report, admin.getId(), "COLLECT");

        List<PekReportProtocolSource> resultRows = sourceRepository.findByReportId(report.getId()).stream()
                .filter(s -> s.getProtocolResultId() != null).toList();
        assertEquals(1, resultRows.size());
        assertEquals(PekMatchStatus.AMBIGUOUS, resultRows.get(0).getMatchStatus());
        assertNull(resultRows.get(0).getProgramIndicatorId());
    }

    // --- Test H: Fallback disabled but explicit link still matches ---
    @Test
    void fallbackDisabled_explicitControlItemId_stillMatches() throws Exception {
        PekSettings settings = settingsRepository.findByCompanyId(companyId).orElseThrow();
        settings.setAllowFallbackMatching(false);
        settingsRepository.save(settings);

        PekProgram program = createActiveProgram();
        PekProgramControlItem ci = createControlItem(program.getId(), "CI-NF", "Контроль", null);
        PekProgramIndicator ind = createIndicator(program.getId(), ci.getId(), "SO2", "мг/м3");

        PekReport report = createReport(program.getId());
        Long protocolId = createProtocol("2026-08-15");

        Protocol protocol = protocolRepository.findById(protocolId).orElseThrow();
        protocol.setStatus(ProtocolStatus.SIGNED);
        protocol.setPekControlItemId(ci.getId());
        protocolRepository.save(protocol);

        addResult(protocolId, 1, "SO2", "мг/м3", BigDecimal.valueOf(5));

        autoCollectionService.collectWithChangeDetection(report, admin.getId(), "COLLECT");

        List<PekReportProtocolSource> resultRows = sourceRepository.findByReportId(report.getId()).stream()
                .filter(s -> s.getProtocolResultId() != null).toList();
        assertEquals(1, resultRows.size());
        assertEquals(PekMatchStatus.MATCHED, resultRows.get(0).getMatchStatus(),
                "explicit link must still match even when fallback is disabled");
        assertEquals(ind.getId(), resultRows.get(0).getProgramIndicatorId());
    }

    @Test
    void fallbackDisabled_onlyNameUnit_resultsInUnmatched() throws Exception {
        PekSettings settings = settingsRepository.findByCompanyId(companyId).orElseThrow();
        settings.setAllowFallbackMatching(false);
        settingsRepository.save(settings);

        PekProgram program = createActiveProgram();
        PekProgramControlItem ci = createControlItem(program.getId(), "CI-NF2", "Контроль", null);
        createIndicator(program.getId(), ci.getId(), "Пыль", "мг/м3");

        PekReport report = createReport(program.getId());
        Long protocolId = createProtocol("2026-08-15");
        signProtocol(protocolId);
        addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(5));

        autoCollectionService.collectWithChangeDetection(report, admin.getId(), "COLLECT");

        List<PekReportProtocolSource> resultRows = sourceRepository.findByReportId(report.getId()).stream()
                .filter(s -> s.getProtocolResultId() != null).toList();
        assertEquals(1, resultRows.size());
        assertEquals(PekMatchStatus.UNMATCHED, resultRows.get(0).getMatchStatus(),
                "name+unit fallback must not run when allowFallbackMatching=false");
    }

    // --- Test C: Manual collect idempotency ---
    @Test
    void manualCollect_secondRunWithNoChanges_doesNotBumpRevisionOrCreateHistory() throws Exception {
        PekProgram program = createActiveProgram();
        PekProgramControlItem ci = createControlItem(program.getId(), "CI-ID", "Контроль", null);
        createIndicator(program.getId(), ci.getId(), "Пыль", "мг/м3");

        PekReport report = createReport(program.getId());
        Long protocolId = createProtocol("2026-08-15");
        signProtocol(protocolId);
        addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(5));

        autoCollectionService.collectWithChangeDetection(report, admin.getId(), "COLLECT");
        PekReport afterFirst = reportRepository.findById(report.getId()).orElseThrow();
        long revisionAfterFirst = afterFirst.getContentRevision();
        int rowsAfterFirst = sourceRepository.findByReportId(report.getId()).size();
        long collectHistoryAfterFirst = countCollectEntries(report.getId());
        assertTrue(revisionAfterFirst > 0);
        assertEquals(1, collectHistoryAfterFirst);

        autoCollectionService.collectWithChangeDetection(report, admin.getId(), "COLLECT");
        PekReport afterSecond = reportRepository.findById(report.getId()).orElseThrow();

        assertEquals(revisionAfterFirst, afterSecond.getContentRevision(),
                "no-op collect must not bump contentRevision");
        assertEquals(rowsAfterFirst, sourceRepository.findByReportId(report.getId()).size(),
                "no-op collect must not create duplicate source rows");
        assertEquals(collectHistoryAfterFirst, countCollectEntries(report.getId()),
                "no-op collect must not create duplicate COLLECT history");
    }

    private long countCollectEntries(Long reportId) {
        return historyRepository.findByReportIdOrderByPerformedAtAscIdAsc(reportId).stream()
                .filter(h -> "COLLECT".equals(h.getAction())).count();
    }
}
