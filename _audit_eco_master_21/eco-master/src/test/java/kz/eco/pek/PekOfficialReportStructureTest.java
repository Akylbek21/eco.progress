package kz.eco.pek;

import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.company.SpecialMonitoringType;
import kz.eco.laboratory.Laboratory;
import kz.eco.laboratory.LaboratoryEmployee;
import kz.eco.laboratory.LaboratoryEmployeeRepository;
import kz.eco.laboratory.LaboratoryRepository;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.pek.docgen.PekReportDocumentGenerationService;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import com.jayway.jsonpath.JsonPath;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Official (state-facing) PEK report structure: {@link PekReportResultRow} generation from
 * {@code ProtocolResult} via {@link PekReportCollectionService#collect}, table applicability,
 * official readiness checks ({@link PekOfficialReportDataService}), report-level actual capacity,
 * the frozen laboratory snapshot, and official DOCX generation from those rows.
 *
 * <p>Reuses {@link PekReportCollectionReconciliationTest}'s pattern of constructing an ACTIVE
 * {@link PekProgram} directly via repositories rather than the submit-review/approve/activate HTTP
 * workflow (see that class's javadoc for why).
 */
@SpringBootTest
@Transactional
class PekOfficialReportStructureTest {

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
    @Autowired private PekEmissionSourceRepository emissionSourceRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportResultRowRepository resultRowRepository;
    @Autowired private PekReportService reportService;
    @Autowired private PekReportCollectionService collectionService;
    @Autowired private PekOfficialReportDataService officialReportDataService;
    @Autowired private PekReportReadinessService readinessService;
    @Autowired private PekSettingsRepository settingsRepository;
    @Autowired private PekReportDocumentGenerationService documentGenerationService;

    private MockMvc mockMvc;
    private Long companyId;
    private Long objectId;
    private Long laboratoryId;
    private Long executorId;
    private User labUser;
    private User headUser;

    private RequestPostProcessor asRole(User user, UserRole role) {
        return authentication(new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("ТОО Official Report Test " + System.nanoTime());
        company.setBin("770099887766");
        company.setLegalAddress("г. Алматы");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Цех Official");
        object.setAddress("г. Алматы, промзона");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        Laboratory lab = new Laboratory();
        lab.setName("Official Lab");
        lab.setLegalName("ТОО Official Lab");
        lab.setBin("880011223344");
        lab.setAddress("г. Алматы");
        lab.setAccreditationNumber("KZ.OFFICIAL.001");
        lab.setAccreditationIssuedAt(LocalDate.of(2020, 1, 1));
        lab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        lab.setDirectorName("Директор");
        lab.setLaboratoryHeadName("Зав. лаб.");
        lab.setDefault(true);
        lab.setActive(true);
        laboratoryRepository.save(lab);
        laboratoryId = lab.getId();

        labUser = user("official-lab-", UserRole.LABORATORY);
        headUser = user("official-head-", UserRole.HEAD);
        membership(headUser);
        membership(labUser);

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

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                headUser, null, List.of(new SimpleGrantedAuthority("ROLE_HEAD")));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Autowired
    private PekStaffAssignmentRepository membershipRepository;

    private void membership(User user) {
        PekStaffAssignment m = new PekStaffAssignment();
        m.setCompanyId(companyId);
        m.setUserId(user.getId());
        m.setTier(PekStaffTier.defaultForRole(user.getRole()));
        m.setStatus(PekMembershipStatus.ACTIVE);
        membershipRepository.save(m);
    }

    private User user(String prefix, UserRole role) {
        User u = new User();
        u.setEmail(prefix + System.nanoTime() + "@ecoprogress.kz");
        u.setPasswordHash(passwordEncoder.encode("demo123"));
        u.setName(prefix);
        u.setRole(role);
        u.setType(ClientType.staff);
        userRepository.save(u);
        return u;
    }

    private PekProgram createActiveProgram(PekMonitoringType directionType) {
        PekProgram program = new PekProgram();
        program.setCompanyId(companyId);
        program.setObjectId(objectId);
        program.setNumber("OFF-" + System.nanoTime());
        program.setName("Official Program");
        program.setValidFrom(LocalDate.of(2026, 1, 1));
        program.setValidUntil(LocalDate.of(2026, 12, 31));
        program.setStatus(PekProgramStatus.ACTIVE);
        program.setCreatedBy(1L);
        programRepository.save(program);

        if (directionType != null) {
            PekProgramMonitoring direction = new PekProgramMonitoring();
            direction.setProgramId(program.getId());
            direction.setMonitoringType(directionType);
            direction.setName("Направление " + directionType);
            direction.setMethodology("Инструментальный");
            direction.setFrequencyType(PekFrequencyType.QUARTERLY);
            directionRepository().save(direction);
        }
        return program;
    }

    @Autowired
    private PekProgramMonitoringRepository directionRepo;

    private PekProgramMonitoringRepository directionRepository() {
        return directionRepo;
    }

    private PekProgramControlItem createEmissionControlItem(Long programId, Long emissionSourceId) {
        PekProgramControlItem item = new PekProgramControlItem();
        item.setProgramId(programId);
        item.setCode("CI-EMISSION");
        item.setName("Контроль выбросов");
        item.setControlType(PekControlType.EMISSION);
        item.setEmissionSourceId(emissionSourceId);
        item.setFrequencyType(PekFrequencyType.QUARTERLY);
        item.setFrequencyValue(1);
        item.setMandatory(true);
        item.setActive(true);
        controlItemRepository.save(item);
        return item;
    }

    private PekProgramIndicator createIndicator(Long programId, Long controlItemId, String name, String unit,
                                                 BigDecimal normativeValue) {
        PekProgramIndicator indicator = new PekProgramIndicator();
        indicator.setProgramId(programId);
        indicator.setControlItemId(controlItemId);
        indicator.setIndicatorName(name);
        indicator.setUnit(unit);
        indicator.setComparisonType(ComparisonType.LESS_OR_EQUAL);
        indicator.setNormativeValue(normativeValue);
        indicator.setMandatory(true);
        indicatorRepository.save(indicator);
        return indicator;
    }

    private PekEmissionSource createEmissionSource(Long programId, int operatingHoursPerYear) {
        PekEmissionSource source = new PekEmissionSource();
        source.setProgramId(programId);
        source.setCode("ES-1");
        source.setName("Труба №1");
        source.setOperatingHoursPerYear(operatingHoursPerYear);
        emissionSourceRepository.save(source);
        return source;
    }

    private PekReport createReport(Long programId, int quarter) {
        var request = new PekApiDtos.CreateReportRequest(companyId, objectId, "QUARTER", 2026, quarter, programId, false);
        PekApiDtos.ReportResponse response = reportService.create(request, headUser.getId());
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

    private void finalizeProtocol(Long protocolId) {
        // The default (unconfigured) company setting is includeOnlySignedProtocols=true - use
        // SIGNED so these tests exercise the real default policy, not a test-only relaxation.
        Protocol protocol = protocolRepository.findById(protocolId).orElseThrow();
        protocol.setStatus(ProtocolStatus.SIGNED);
        protocolRepository.save(protocol);
    }

    private ProtocolResult addEmissionResult(Long protocolId, int rowNumber, String indicatorName,
                                              BigDecimal pdvGs, BigDecimal resultGs) {
        ProtocolResult result = new ProtocolResult();
        result.setProtocolId(protocolId);
        result.setRowNumber(rowNumber);
        result.setIndicatorName(indicatorName);
        result.setUnit("г/с");
        result.setPdvGs(pdvGs);
        result.setResultGs(resultGs);
        result.setResultValue(resultGs);
        return protocolResultRepository.save(result);
    }

    // ---------------------------------------------------------------------------------------
    // 1-4: row generation, correct linkage, normative/actual not swapped
    // ---------------------------------------------------------------------------------------

    @Test
    void singleProtocolResult_producesOneCorrectOfficialRow() throws Exception {
        PekProgram program = createActiveProgram(PekMonitoringType.EMISSION_SOURCE);
        PekEmissionSource source = createEmissionSource(program.getId(), 8760);
        PekProgramControlItem item = createEmissionControlItem(program.getId(), source.getId());
        PekProgramIndicator indicator = createIndicator(program.getId(), item.getId(), "Пыль", "г/с", BigDecimal.TEN);
        PekReport report = createReport(program.getId(), 1);

        Long protocolId = createProtocol("2026-01-15");
        finalizeProtocol(protocolId);
        ProtocolResult result = addEmissionResult(protocolId, 1, "Пыль", BigDecimal.TEN, BigDecimal.valueOf(3));

        collectionService.collect(report);

        List<PekReportResultRow> rows = resultRowRepository.findByReportIdOrderBySectionTypeAscIndicatorNameAsc(report.getId());
        assertEquals(1, rows.size());
        PekReportResultRow row = rows.get(0);
        assertEquals(PekOfficialTableType.EMISSIONS, row.getSectionType());
        assertEquals(item.getId(), row.getControlItemId());
        assertEquals(source.getId(), row.getEmissionSourceId());
        assertEquals(indicator.getId(), row.getProgramIndicatorId());
        assertEquals(protocolId, row.getProtocolId());
        assertEquals(result.getId(), row.getProtocolResultId());
        // 3: normative and actual are not swapped.
        assertEquals(0, BigDecimal.TEN.compareTo(row.getNormativeGs()));
        assertEquals(0, BigDecimal.valueOf(3).compareTo(row.getActualGs()));
        assertFalse(row.isExceedance(), "3 g/s under a 10 g/s normative is not an exceedance");
    }

    @Test
    void multipleResultsOnOneProtocol_produceMultipleRows() throws Exception {
        PekProgram program = createActiveProgram(PekMonitoringType.EMISSION_SOURCE);
        PekEmissionSource source = createEmissionSource(program.getId(), 8760);
        PekProgramControlItem item = createEmissionControlItem(program.getId(), source.getId());
        createIndicator(program.getId(), item.getId(), "Пыль", "г/с", BigDecimal.TEN);
        createIndicator(program.getId(), item.getId(), "Диоксид серы", "г/с", BigDecimal.valueOf(5));
        PekReport report = createReport(program.getId(), 1);

        Long protocolId = createProtocol("2026-01-15");
        finalizeProtocol(protocolId);
        addEmissionResult(protocolId, 1, "Пыль", BigDecimal.TEN, BigDecimal.valueOf(3));
        addEmissionResult(protocolId, 2, "Диоксид серы", BigDecimal.valueOf(5), BigDecimal.valueOf(1));

        collectionService.collect(report);

        List<PekReportResultRow> rows = resultRowRepository.findByReportIdOrderBySectionTypeAscIndicatorNameAsc(report.getId());
        assertEquals(2, rows.size());
        assertTrue(rows.stream().allMatch(r -> r.getProtocolId().equals(protocolId)));
        assertEquals(2, rows.stream().map(PekReportResultRow::getProtocolResultId).distinct().count());
    }

    // ---------------------------------------------------------------------------------------
    // 5: exceedance + ratio
    // ---------------------------------------------------------------------------------------

    @Test
    void exceedingResult_flagsExceedanceWithCorrectRatio() throws Exception {
        PekProgram program = createActiveProgram(PekMonitoringType.EMISSION_SOURCE);
        PekEmissionSource source = createEmissionSource(program.getId(), 8760);
        PekProgramControlItem item = createEmissionControlItem(program.getId(), source.getId());
        createIndicator(program.getId(), item.getId(), "Пыль", "г/с", BigDecimal.TEN);
        PekReport report = createReport(program.getId(), 1);

        Long protocolId = createProtocol("2026-01-15");
        finalizeProtocol(protocolId);
        addEmissionResult(protocolId, 1, "Пыль", BigDecimal.TEN, BigDecimal.valueOf(20)); // 2x over

        collectionService.collect(report);

        List<PekReportResultRow> rows = resultRowRepository.findByReportIdOrderBySectionTypeAscIndicatorNameAsc(report.getId());
        assertEquals(1, rows.size());
        assertTrue(rows.get(0).isExceedance());
        assertNotNull(rows.get(0).getExceedanceRatio());
        assertEquals(0, BigDecimal.valueOf(2).compareTo(rows.get(0).getExceedanceRatio()));
    }

    // ---------------------------------------------------------------------------------------
    // 6-9: applicability + readiness (strict mode required for these to actually block)
    // ---------------------------------------------------------------------------------------

    private void enableStrictOfficialReadiness() {
        PekSettings settings = new PekSettings();
        settings.setCompanyId(companyId);
        settings.setDefaultReportType(PekSettingsReportType.QUARTERLY);
        settings.setIncludeOnlySignedProtocols(false);
        settings.setAllowFallbackMatching(true);
        settings.setRequireManualAmbiguousConfirmation(true);
        settings.setRequireAllPlanFactItems(false);
        settings.setBlockSubmitWithUnmatchedResults(false);
        settings.setBlockSubmitWithAmbiguousResults(false);
        settings.setBlockSubmitWithStaleSources(false);
        settings.setBlockSubmitWithOpenExceedances(false);
        settings.setRequireOfficialReportComplete(true);
        settings.setNotifyBeforeDeadlineDays(7);
        settings.setCreatedBy(headUser.getId());
        settings.setUpdatedBy(headUser.getId());
        settingsRepository.save(settings);
    }

    @Test
    void nonApplicableTable_doesNotAppearAndDoesNotBlockReadiness() throws Exception {
        // Program declares ONLY EMISSION_SOURCE - WASTEWATER must be reported not-applicable, and
        // its absence must never contribute a readiness blocker.
        PekProgram program = createActiveProgram(PekMonitoringType.EMISSION_SOURCE);
        PekEmissionSource source = createEmissionSource(program.getId(), 8760);
        PekProgramControlItem item = createEmissionControlItem(program.getId(), source.getId());
        createIndicator(program.getId(), item.getId(), "Пыль", "г/с", BigDecimal.TEN);
        PekReport report = createReport(program.getId(), 1);
        Long protocolId = createProtocol("2026-01-15");
        finalizeProtocol(protocolId);
        addEmissionResult(protocolId, 1, "Пыль", BigDecimal.TEN, BigDecimal.valueOf(3));
        collectionService.collect(report);
        enableStrictOfficialReadiness();

        PekApiDtos.OfficialReportData data = officialReportDataService.getOfficialData(
                report.getId(), reportRepository.findById(report.getId()).orElseThrow(), readinessService.evaluate(report));
        var wastewater = data.applicability().stream()
                .filter(a -> "WASTEWATER".equals(a.tableType())).findFirst().orElseThrow();
        assertFalse(wastewater.applicable());
        assertNotNull(wastewater.reason());

        var readiness = readinessService.evaluate(reportRepository.findById(report.getId()).orElseThrow());
        assertFalse(readiness.issues().stream().anyMatch(i -> i.message() != null && i.message().contains("WASTEWATER")));
    }

    @Test
    void applicableIncompleteTable_blocksReadinessInStrictMode() throws Exception {
        // AMBIENT_AIR is declared but never collected - the table stays applicable and empty.
        PekProgram program = createActiveProgram(PekMonitoringType.AMBIENT_AIR);
        PekReport report = createReport(program.getId(), 1);
        enableStrictOfficialReadiness();

        var readiness = readinessService.evaluate(reportRepository.findById(report.getId()).orElseThrow());
        assertFalse(readiness.ready());
        assertTrue(readiness.blockingIssues().stream().anyMatch(i -> "REQUIRED_TABLE_INCOMPLETE".equals(i.code())));
    }

    @Test
    void missingNormative_blocksReadinessInStrictMode() throws Exception {
        PekProgram program = createActiveProgram(PekMonitoringType.EMISSION_SOURCE);
        PekEmissionSource source = createEmissionSource(program.getId(), 8760);
        PekProgramControlItem item = createEmissionControlItem(program.getId(), source.getId());
        createIndicator(program.getId(), item.getId(), "Пыль", "г/с", null); // no normative at all
        PekReport report = createReport(program.getId(), 1);
        Long protocolId = createProtocol("2026-01-15");
        finalizeProtocol(protocolId);
        addEmissionResult(protocolId, 1, "Пыль", null, BigDecimal.valueOf(3));
        collectionService.collect(report);
        enableStrictOfficialReadiness();

        var readiness = readinessService.evaluate(reportRepository.findById(report.getId()).orElseThrow());
        assertFalse(readiness.ready());
        assertTrue(readiness.blockingIssues().stream().anyMatch(i -> "MISSING_NORMATIVE".equals(i.code())));
    }

    @Test
    void missingMandatoryProtocolResult_blocksReadinessInStrictMode() throws Exception {
        PekProgram program = createActiveProgram(PekMonitoringType.EMISSION_SOURCE);
        PekEmissionSource source = createEmissionSource(program.getId(), 8760);
        PekProgramControlItem item = createEmissionControlItem(program.getId(), source.getId());
        createIndicator(program.getId(), item.getId(), "Пыль", "г/с", BigDecimal.TEN); // mandatory, never measured
        PekReport report = createReport(program.getId(), 1);
        collectionService.collect(report); // nothing to collect - no protocol at all
        enableStrictOfficialReadiness();

        var readiness = readinessService.evaluate(reportRepository.findById(report.getId()).orElseThrow());
        assertFalse(readiness.ready());
        assertTrue(readiness.blockingIssues().stream().anyMatch(i -> "MISSING_PROTOCOL_RESULT".equals(i.code())));
    }

    @Test
    void defaultCompanySettings_officialGapsAreWarningsOnly_neverBlockExistingWorkflow() throws Exception {
        // Without opting into requireOfficialReportComplete (the default for every existing
        // company), the same gaps as above must NOT block readiness - existing report workflows
        // must keep behaving exactly as before this module fix.
        PekProgram program = createActiveProgram(PekMonitoringType.AMBIENT_AIR);
        PekReport report = createReport(program.getId(), 1);

        var readiness = readinessService.evaluate(reportRepository.findById(report.getId()).orElseThrow());
        assertTrue(readiness.issues().stream().anyMatch(i -> "REQUIRED_TABLE_INCOMPLETE".equals(i.code())),
                "the gap is still computed and surfaced");
        assertTrue(readiness.blockingIssues().stream().noneMatch(i -> "REQUIRED_TABLE_INCOMPLETE".equals(i.code())),
                "but not blocking by default");
    }

    // ---------------------------------------------------------------------------------------
    // 10: tenant isolation
    // ---------------------------------------------------------------------------------------

    @Test
    void officialDataEndpoint_isForbiddenForForeignCompanyUser() throws Exception {
        PekProgram program = createActiveProgram(PekMonitoringType.EMISSION_SOURCE);
        PekReport report = createReport(program.getId(), 1);

        Company otherCompany = new Company();
        otherCompany.setName("Foreign Co " + System.nanoTime());
        otherCompany.setBin("990011223344");
        otherCompany.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(otherCompany);
        User foreignHead = user("foreign-head-", UserRole.HEAD);

        mockMvc.perform(get("/api/pek/reports/" + report.getId() + "/official-data")
                        .with(asRole(foreignHead, UserRole.HEAD)))
                .andExpect(status().isForbidden());
    }

    // ---------------------------------------------------------------------------------------
    // 11: laboratory snapshot immutability
    // ---------------------------------------------------------------------------------------

    @Test
    void laboratorySnapshot_isFrozenAndSurvivesLaterLabCardChanges() throws Exception {
        PekProgram program = createActiveProgram(PekMonitoringType.EMISSION_SOURCE);
        PekEmissionSource source = createEmissionSource(program.getId(), 8760);
        PekProgramControlItem item = createEmissionControlItem(program.getId(), source.getId());
        createIndicator(program.getId(), item.getId(), "Пыль", "г/с", BigDecimal.TEN);
        PekReport report = createReport(program.getId(), 1);
        Long protocolId = createProtocol("2026-01-15");
        finalizeProtocol(protocolId);
        addEmissionResult(protocolId, 1, "Пыль", BigDecimal.TEN, BigDecimal.valueOf(3));

        collectionService.collect(report);
        PekReport afterCollect = reportRepository.findById(report.getId()).orElseThrow();
        assertTrue(afterCollect.hasLaboratorySnapshot());
        assertEquals("Official Lab", afterCollect.getLaboratoryNameSnapshot());
        assertEquals("880011223344", afterCollect.getLaboratoryBinSnapshot());
        assertEquals("KZ.OFFICIAL.001", afterCollect.getAccreditationNumberSnapshot());

        // Edit the laboratory card after the snapshot was fixed.
        Laboratory lab = laboratoryRepository.findById(laboratoryId).orElseThrow();
        lab.setName("Renamed Lab");
        lab.setAccreditationNumber("KZ.CHANGED.999");
        laboratoryRepository.saveAndFlush(lab);

        // Re-collect (idempotent path) must not overwrite the frozen snapshot.
        collectionService.collect(afterCollect);
        PekReport afterSecondCollect = reportRepository.findById(report.getId()).orElseThrow();
        assertEquals("Official Lab", afterSecondCollect.getLaboratoryNameSnapshot(),
                "snapshot must stay frozen after the laboratory card is edited");
        assertEquals("KZ.OFFICIAL.001", afterSecondCollect.getAccreditationNumberSnapshot());
    }

    // ---------------------------------------------------------------------------------------
    // 12: actual capacity relates to the report, not the program
    // ---------------------------------------------------------------------------------------

    @Test
    void actualCapacity_isPerReport_andRoundTripsThroughTheApi() throws Exception {
        PekProgram program = createActiveProgram(PekMonitoringType.EMISSION_SOURCE);
        // Module fix: PekProgram no longer has an actualCapacity field at all - design capacity is
        // the only capacity figure left on the program; actual (as-operated) capacity is
        // exclusively a PekReport-level field now (asserted via the PATCH below).
        program.setDesignCapacity("120 Гкал/ч");
        program.setDesignCapacityUnit("Гкал/ч");
        programRepository.saveAndFlush(program);
        PekReport reportQ1 = createReport(program.getId(), 1);
        PekReport reportQ2 = createReport(program.getId(), 2);
        // Same persistence context as the MockMvc call below (one @Transactional test method) -
        // reportQ1 is Hibernate's own managed instance, so its version field mutates in place the
        // moment the controller flushes. Captured as a primitive here so the "stale If-Match" call
        // further down genuinely uses the PRE-update version, not whatever reportQ1 reflects by then.
        long originalVersion = reportQ1.getVersion();

        String body = mockMvc.perform(patch("/api/pek/reports/" + reportQ1.getId() + "/general")
                        .with(asRole(headUser, UserRole.HEAD))
                        .header("If-Match", originalVersion)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"actualCapacity\":\"84 Гкал/ч\",\"actualCapacityUnit\":\"Гкал/ч\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.actualCapacity").value("84 Гкал/ч"))
                .andReturn().getResponse().getContentAsString();
        assertEquals("84 Гкал/ч", JsonPath.read(body, "$.data.actualCapacity"));

        // A different quarter's report for the SAME program is unaffected.
        PekReport reloadedQ2 = reportRepository.findById(reportQ2.getId()).orElseThrow();
        assertNotNull(reloadedQ2); // still null actualCapacity - never derived from Q1's edit
        org.junit.jupiter.api.Assertions.assertNull(reloadedQ2.getActualCapacity());

        // Optimistic locking: a stale If-Match is rejected.
        mockMvc.perform(patch("/api/pek/reports/" + reportQ1.getId() + "/general")
                        .with(asRole(headUser, UserRole.HEAD))
                        .header("If-Match", originalVersion) // stale now, already bumped above
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"actualCapacity\":\"90 Гкал/ч\"}"))
                .andExpect(status().isConflict());
    }

    // ---------------------------------------------------------------------------------------
    // 13/14: official DOCX renders from official rows; internal renderer untouched (smoke)
    // ---------------------------------------------------------------------------------------

    @Test
    void officialDocx_rendersFromOfficialResultRows() throws Exception {
        PekProgram program = createActiveProgram(PekMonitoringType.EMISSION_SOURCE);
        PekEmissionSource source = createEmissionSource(program.getId(), 8760);
        PekProgramControlItem item = createEmissionControlItem(program.getId(), source.getId());
        createIndicator(program.getId(), item.getId(), "Пыль", "г/с", BigDecimal.TEN);
        PekReport report = createReport(program.getId(), 1);
        Long protocolId = createProtocol("2026-01-15");
        finalizeProtocol(protocolId);
        addEmissionResult(protocolId, 1, "Пыль", BigDecimal.TEN, BigDecimal.valueOf(3));
        collectionService.collect(report);

        PekReportDocumentVersion version = documentGenerationService.generateOfficialDocx(report.getId(), headUser.getId());
        assertNotNull(version);
        assertNotNull(version.getDocxFileId());
        // The generated document's snapshot carries the emissions table content.
        assertTrue(version.getSnapshotJson().contains("EMISSIONS"));
        assertTrue(version.getSnapshotJson().contains("Пыль"));
    }

    // ---------------------------------------------------------------------------------------
    // Contract gap item 9: official-data rows carry protocolNumber without an N+1 lookup.
    // ---------------------------------------------------------------------------------------

    @Test
    void officialData_emissionRows_carryProtocolNumber() throws Exception {
        PekProgram program = createActiveProgram(PekMonitoringType.EMISSION_SOURCE);
        PekEmissionSource source = createEmissionSource(program.getId(), 8760);
        PekProgramControlItem item = createEmissionControlItem(program.getId(), source.getId());
        createIndicator(program.getId(), item.getId(), "Пыль", "г/с", BigDecimal.TEN);
        PekReport report = createReport(program.getId(), 1);
        Long protocolId = createProtocol("2026-01-15");
        finalizeProtocol(protocolId);
        addEmissionResult(protocolId, 1, "Пыль", BigDecimal.TEN, BigDecimal.valueOf(3));
        collectionService.collect(report);

        Protocol protocol = protocolRepository.findById(protocolId).orElseThrow();
        PekApiDtos.OfficialReportData data = officialReportDataService.getOfficialData(
                report.getId(), reportRepository.findById(report.getId()).orElseThrow(), readinessService.evaluate(report));

        assertEquals(1, data.tables().emissions().size());
        PekApiDtos.EmissionResultRow row = data.tables().emissions().get(0);
        assertEquals(protocolId, row.protocolId());
        assertEquals(protocol.getProtocolNumber(), row.protocolNumber());
    }

    // ---------------------------------------------------------------------------------------
    // Contract gap item 10: calculatedEmissions carries method/raw material/consumption/hours.
    // ---------------------------------------------------------------------------------------

    @Test
    void officialData_calculatedEmissions_carriesMethodAndOperatingHours() throws Exception {
        PekProgram program = createActiveProgram(PekMonitoringType.EMISSION_SOURCE);
        PekEmissionSource source = createEmissionSource(program.getId(), 8760);
        PekProgramControlItem item = createEmissionControlItem(program.getId(), source.getId());
        createIndicator(program.getId(), item.getId(), "Оксид азота", "г/с", BigDecimal.TEN);
        PekReport report = createReport(program.getId(), 1);
        Long protocolId = createProtocol("2026-01-15");
        finalizeProtocol(protocolId);
        ProtocolResult result = addEmissionResult(protocolId, 1, "Оксид азота", BigDecimal.TEN, BigDecimal.valueOf(4));
        result.setCalculationStatus("CALCULATED");
        result.setTestingMethodNd("Расчётный метод по удельным показателям");
        protocolResultRepository.save(result);

        collectionService.collect(report);

        PekApiDtos.OfficialReportData data = officialReportDataService.getOfficialData(
                report.getId(), reportRepository.findById(report.getId()).orElseThrow(), readinessService.evaluate(report));

        assertEquals(1, data.tables().calculatedEmissions().size());
        assertEquals(0, data.tables().emissions().size(), "a CALCULATED result must not also land in the plain emissions table");
        PekApiDtos.CalculatedEmissionResultRow row = data.tables().calculatedEmissions().get(0);
        assertEquals("Расчётный метод по удельным показателям", row.calculationMethod());
        assertEquals("8760", row.equipmentOperatingHours());
        assertEquals(protocolId, row.protocolId());
    }

    // ---------------------------------------------------------------------------------------
    // Contract gap item 11: the existing plain-array official-data contract is not reverted.
    // ---------------------------------------------------------------------------------------

    @Test
    void officialData_tablesAreStillPlainArrays_notWrappedObjects() throws Exception {
        PekProgram program = createActiveProgram(PekMonitoringType.EMISSION_SOURCE);
        PekReport report = createReport(program.getId(), 1);

        PekApiDtos.OfficialReportData data = officialReportDataService.getOfficialData(
                report.getId(), reportRepository.findById(report.getId()).orElseThrow(), readinessService.evaluate(report));

        // Compiles and returns a List<...> directly (not a {applicable,status,rowCount,...} wrapper) -
        // the type itself is the assertion; these calls only fail to compile if the contract regresses.
        assertNotNull(data.tables().emissions());
        assertNotNull(data.tables().instrumentalMeasurements());
        assertNotNull(data.applicability());
        assertTrue(data.applicability().stream().anyMatch(a -> "EMISSIONS".equals(a.tableType())));
    }
}
