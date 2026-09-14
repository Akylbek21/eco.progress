package kz.eco.pek;

import com.jayway.jsonpath.JsonPath;
import kz.eco.common.exception.BadRequestException;
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
import org.springframework.security.core.Authentication;
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
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Task 4 (real reconciliation, never skip a result) + Task 1 (distinct-protocol count) + Task 2
 * (program period coverage) + Task 5 (company/object scope) coverage for the rewritten
 * {@link PekReportCollectionService#collect}.
 *
 * <p>Deliberately builds the PekProgram directly via {@link PekProgramRepository} at ACTIVE status
 * instead of driving it through the submit-review/approve/activate HTTP workflow that
 * {@code PekModuleApiTest} uses: that workflow is affected by a pre-existing (reproduced on this
 * repository's HEAD commit before any of this task's changes - see the module report's "Known
 * limitations") test-harness issue where a single non-committing {@code @Transactional} test method
 * can read back a stale in-memory {@code @Version} after {@code save()} because neither
 * {@code JpaRepository.save()} nor a same-entity {@code findById()} forces an intermediate flush,
 * so the returned DTO's version does not yet reflect the just-applied increment. That issue is
 * unrelated to this task's reconciliation logic - constructing the ACTIVE program directly sidesteps
 * it entirely rather than working around it in application code that isn't otherwise broken.
 *
 * <p>Rollback-on-error (transactional atomicity of a failed collect()) is not covered by a dedicated
 * test here: forcing a realistic mid-collect() failure (e.g. a genuine DB-level constraint
 * violation) without faking the assertion would require either corrupting FK data out from under a
 * live transaction or a Mockito spy around the repository layer that this codebase's established
 * PEK test style (real Spring context, real H2, no repository mocking - see PekModuleApiTest) does
 * not use elsewhere; @Transactional's standard rollback-on-uncaught-exception behavior is Spring's
 * own well-tested guarantee, not something this collector reimplements, so it is not re-verified
 * here rather than faked.
 */
@SpringBootTest
@Transactional
class PekReportCollectionReconciliationTest {

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
    @Autowired private PekReportService reportService;
    @Autowired private PekReportCollectionService collectionService;
    @Autowired private PekAccessService accessService;
    @Autowired private PekSettingsRepository settingsRepository;

    private MockMvc mockMvc;
    private Long companyId;
    private Long objectId;
    private Long laboratoryId;
    private Long executorId;
    private User labUser;

    private RequestPostProcessor asRole(User user, UserRole role) {
        return authentication(new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.name()))));
    }

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();

        Company company = new Company();
        company.setName("ТОО Reconciliation Test");
        company.setBin("770011223344");
        company.setLegalAddress("г. Алматы");
        company.setPhone("+77001112233");
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);
        companyId = company.getId();

        CompanyObject object = new CompanyObject();
        object.setCompanyId(companyId);
        object.setName("Цех Reconciliation");
        object.setAddress("г. Алматы, промзона");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);
        objectId = object.getId();

        Laboratory lab = new Laboratory();
        lab.setName("Reconciliation Lab");
        lab.setLegalName("ТОО Reconciliation Lab");
        lab.setAddress("г. Алматы");
        lab.setAccreditationNumber("KZ.REC.001");
        lab.setAccreditationIssuedAt(LocalDate.of(2020, 1, 1));
        lab.setAccreditationValidUntil(LocalDate.of(2030, 12, 31));
        lab.setDirectorName("Директор");
        lab.setLaboratoryHeadName("Зав. лаб.");
        lab.setDefault(true);
        lab.setActive(true);
        laboratoryRepository.save(lab);
        laboratoryId = lab.getId();

        labUser = new User();
        labUser.setEmail("rec-lab-" + System.nanoTime() + "@ecoprogress.kz");
        labUser.setPasswordHash(passwordEncoder.encode("demo123"));
        labUser.setName("Lab Tester");
        labUser.setRole(UserRole.LABORATORY);
        labUser.setType(ClientType.staff);
        userRepository.save(labUser);

        // This test isolates reconciliation semantics and intentionally exercises APPROVED as a
        // finalized legacy protocol. The production default is signed-only; make the exception
        // explicit for this company's test policy instead of weakening the global default.
        PekSettings settings = new PekSettings();
        settings.setCompanyId(companyId);
        settings.setDefaultReportType(PekSettingsReportType.QUARTERLY);
        settings.setIncludeOnlySignedProtocols(false);
        settings.setAllowFallbackMatching(true);
        settings.setRequireManualAmbiguousConfirmation(true);
        settings.setRequireAllPlanFactItems(true);
        settings.setBlockSubmitWithUnmatchedResults(true);
        settings.setBlockSubmitWithAmbiguousResults(true);
        settings.setBlockSubmitWithStaleSources(true);
        settings.setBlockSubmitWithOpenExceedances(true);
        settings.setNotifyBeforeDeadlineDays(7);
        settings.setNotifyMissingProtocols(true);
        settings.setNotifyExceedances(true);
        settings.setNotifyReportReturned(true);
        settings.setCreatedBy(labUser.getId());
        settings.setUpdatedBy(labUser.getId());
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

    /** Builds an ACTIVE PekProgram with one control item and one indicator directly via
     *  repositories (see class javadoc for why this bypasses the HTTP submit/approve/activate
     *  workflow). */
    private PekProgram createActiveProgram(String validFrom, String validUntil, String indicatorName, String unit) {
        PekProgram program = new PekProgram();
        program.setCompanyId(companyId);
        program.setObjectId(objectId);
        program.setNumber("REC-" + System.nanoTime());
        program.setName("Reconciliation Program");
        program.setValidFrom(LocalDate.parse(validFrom));
        program.setValidUntil(LocalDate.parse(validUntil));
        program.setStatus(PekProgramStatus.ACTIVE);
        program.setCreatedBy(1L);
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

        if (indicatorName != null) {
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
        }
        return program;
    }

    private PekReport createReport(Long programId, int year, int quarter) {
        var request = new PekApiDtos.CreateReportRequest(companyId, objectId, "QUARTER", year, quarter, programId, false);
        PekApiDtos.ReportResponse response = reportService.create(request, 1L);
        return reportRepositoryFind(response.id());
    }

    @Autowired
    private PekReportRepository reportRepositoryDirect;

    private PekReport reportRepositoryFind(Long id) {
        return reportRepositoryDirect.findById(id).orElseThrow();
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
        Protocol protocol = protocolRepository.findById(protocolId).orElseThrow();
        protocol.setStatus(ProtocolStatus.APPROVED);
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

    // --- Task 4: real per-result matching, never skipped ---

    @Test
    void collect_matchedUnmatchedAmbiguous_allProduceRealRows() throws Exception {
        PekProgram program = createActiveProgram("2026-01-01", "2026-12-31", "Пыль", "мг/м3");
        // A second indicator with the SAME name+unit makes any result matching "Пыль"/"мг/м3" AMBIGUOUS.
        PekProgramIndicator ambiguousDuplicate = new PekProgramIndicator();
        ambiguousDuplicate.setProgramId(program.getId());
        ambiguousDuplicate.setControlItemId(controlItemRepository.findByProgramIdOrderBySortOrderAsc(program.getId()).get(0).getId());
        ambiguousDuplicate.setIndicatorName("Пыль");
        ambiguousDuplicate.setUnit("мг/м3");
        ambiguousDuplicate.setComparisonType(ComparisonType.LESS_OR_EQUAL);
        ambiguousDuplicate.setNormativeValue(BigDecimal.ONE);
        ambiguousDuplicate.setMandatory(true);
        indicatorRepository.save(ambiguousDuplicate);

        PekReport report = createReport(program.getId(), 2026, 3);
        Long protocolId = createProtocol("2026-08-15");
        finalizeProtocol(protocolId);
        addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(5)); // AMBIGUOUS: two indicators match
        addResult(protocolId, 2, "Оксид азота", "мг/м3", BigDecimal.valueOf(2)); // UNMATCHED: no such indicator

        collectionService.collect(report);

        List<PekReportProtocolSource> sources = sourceRepository.findByReportId(report.getId());
        List<PekReportProtocolSource> resultRows = sources.stream().filter(s -> s.getProtocolResultId() != null).toList();
        // Task 4: every actual result produces a row - never silently skipped.
        assertEquals(2, resultRows.size());
        assertTrue(resultRows.stream().anyMatch(s -> s.getMatchStatus() == PekMatchStatus.AMBIGUOUS
                && s.getProgramIndicatorId() == null));
        assertTrue(resultRows.stream().anyMatch(s -> s.getMatchStatus() == PekMatchStatus.UNMATCHED
                && s.getProgramIndicatorId() == null));
    }

    @Test
    void collect_unambiguousMatch_isMatchedAndFeedsPlanFact() throws Exception {
        PekProgram program = createActiveProgram("2026-01-01", "2026-12-31", "Пыль", "мг/м3");
        PekReport report = createReport(program.getId(), 2026, 3);
        Long protocolId = createProtocol("2026-08-15");
        finalizeProtocol(protocolId);
        addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(5));

        collectionService.collect(report);

        List<PekReportProtocolSource> resultRows = sourceRepository.findByReportId(report.getId()).stream()
                .filter(s -> s.getProtocolResultId() != null).toList();
        assertEquals(1, resultRows.size());
        assertEquals(PekMatchStatus.MATCHED, resultRows.get(0).getMatchStatus());
        assertTrue(resultRows.get(0).getProgramIndicatorId() != null);

        // Plan/fact excludes non-MATCHED by construction (programIndicatorId only set on MATCHED).
        List<PekReportPlanFactRow> rows = planFactRowRepository.findByReportIdOrderByControlItemIdAsc(report.getId());
        assertEquals(1, rows.size());
        assertEquals(1, rows.get(0).getActualCount());
    }

    // --- Task 3: stale removal on re-collect ---

    @Test
    void recollect_isIdempotent_whenNothingChanged() throws Exception {
        PekProgram program = createActiveProgram("2026-01-01", "2026-12-31", "Пыль", "мг/м3");
        PekReport report = createReport(program.getId(), 2026, 3);
        Long protocolId = createProtocol("2026-08-15");
        finalizeProtocol(protocolId);
        addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(5));

        PekApiDtos.CollectionResult first = collectionService.collect(report);
        int firstRowCount = sourceRepository.findByReportId(report.getId()).size();

        PekApiDtos.CollectionResult second = collectionService.collect(report);
        int secondRowCount = sourceRepository.findByReportId(report.getId()).size();

        assertEquals(firstRowCount, secondRowCount);
        assertEquals(first.linkedProtocolCount(), second.linkedProtocolCount());
        assertEquals(0, second.removedStaleSourceCount());
    }

    @Test
    void recollect_addsRowForNewlyAddedResult() throws Exception {
        PekProgram program = createActiveProgram("2026-01-01", "2026-12-31", "Пыль", "мг/м3");
        PekReport report = createReport(program.getId(), 2026, 3);
        Long protocolId = createProtocol("2026-08-15");
        finalizeProtocol(protocolId);
        addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(5));
        collectionService.collect(report);

        addResult(protocolId, 2, "Пыль", "мг/м3", BigDecimal.valueOf(6));
        collectionService.collect(report);

        List<PekReportProtocolSource> resultRows = sourceRepository.findByReportId(report.getId()).stream()
                .filter(s -> s.getProtocolResultId() != null).toList();
        assertEquals(2, resultRows.size());
    }

    @Test
    void recollect_removesRowForDeletedResult() throws Exception {
        PekProgram program = createActiveProgram("2026-01-01", "2026-12-31", "Пыль", "мг/м3");
        PekReport report = createReport(program.getId(), 2026, 3);
        Long protocolId = createProtocol("2026-08-15");
        finalizeProtocol(protocolId);
        ProtocolResult result = addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(5));
        collectionService.collect(report);
        assertEquals(1, sourceRepository.findByReportId(report.getId()).stream()
                .filter(s -> s.getProtocolResultId() != null).count());

        protocolResultRepository.delete(result);
        PekApiDtos.CollectionResult second = collectionService.collect(report);

        List<PekReportProtocolSource> retained = sourceRepository.findByReportId(report.getId()).stream()
                .filter(s -> s.getProtocolResultId() != null).toList();
        assertEquals(1, retained.size());
        assertEquals(PekMatchStatus.STALE, retained.get(0).getMatchStatus());
        assertTrue(retained.get(0).isExcluded());
        assertTrue(second.removedStaleSourceCount() >= 1);
    }

    @Test
    void recollect_removesLinksForProtocolThatLostFinalStatus() throws Exception {
        PekProgram program = createActiveProgram("2026-01-01", "2026-12-31", "Пыль", "мг/м3");
        PekReport report = createReport(program.getId(), 2026, 3);
        Long protocolId = createProtocol("2026-08-15");
        finalizeProtocol(protocolId);
        addResult(protocolId, 1, "Пыль", "мг/м3", BigDecimal.valueOf(5));
        PekApiDtos.CollectionResult first = collectionService.collect(report);
        assertEquals(1, first.linkedProtocolCount());

        Protocol protocol = protocolRepository.findById(protocolId).orElseThrow();
        protocol.setStatus(ProtocolStatus.DRAFT);
        protocolRepository.save(protocol);

        PekApiDtos.CollectionResult second = collectionService.collect(report);
        assertEquals(0, second.linkedProtocolCount());
        assertTrue(sourceRepository.findByReportId(report.getId()).stream()
                .allMatch(s -> s.getMatchStatus() == PekMatchStatus.STALE && s.isExcluded()));
    }

    // --- Manual links are never auto-deleted ---

    @Test
    void manualLink_isPreservedAndSurfacedAsWarning_whenItsProtocolDropsOut() throws Exception {
        PekProgram program = createActiveProgram("2026-01-01", "2026-12-31", "Пыль", "мг/м3");
        PekReport report = createReport(program.getId(), 2026, 3);
        // A manual link to a protocol that never was, and never will be, part of the actual
        // finalized set for this report - simulates a human manually attaching evidence.
        PekReportProtocolSource manual = new PekReportProtocolSource();
        manual.setReportId(report.getId());
        manual.setProgramId(program.getId());
        manual.setProtocolId(999999L);
        manual.setManual(true);
        manual.setMatchType("MANUAL");
        manual.setMatchStatus(PekMatchStatus.MANUAL);
        manual.setMatchedAt(LocalDateTime.now());
        sourceRepository.save(manual);

        PekApiDtos.CollectionResult result = collectionService.collect(report);

        assertTrue(sourceRepository.findById(manual.getId()).isPresent(), "manual row must never be auto-deleted");
        assertFalse(result.warnings().isEmpty(), "a stale manual link must be surfaced as a warning");
    }

    // --- Task 2: program period coverage ---

    @Test
    void createReport_whenProgramDoesNotCoverPeriod_isRejected() {
        // ACTIVE only through Q1 2026 - a Q3 2026 report must be rejected, not silently attached.
        PekProgram program = createActiveProgram("2026-01-01", "2026-03-31", "Пыль", "мг/м3");
        var request = new PekApiDtos.CreateReportRequest(companyId, objectId, "QUARTER", 2026, 3, program.getId(), false);
        BadRequestException ex = assertThrows(BadRequestException.class, () -> reportService.create(request, 1L));
        assertEquals("PEK_PROGRAM_PERIOD_MISMATCH", ex.getCode());
    }

    @Test
    void creationContext_whenProgramDoesNotCoverPeriod_returnsBlocker() {
        createActiveProgram("2026-01-01", "2026-03-31", "Пыль", "мг/м3");
        PekApiDtos.ReportCreationContext ctx = reportService.creationContext(companyId, objectId, "QUARTER", 2026, 3);
        assertFalse(ctx.blockingReasons().isEmpty());
    }

    @Test
    void collect_whenProgramPeriodChangedAfterReportCreation_isRejected() {
        // Defense in depth: the program covered the period at report-creation time but was edited
        // afterward to no longer cover it - collect() must re-check, not trust the report's
        // already-computed periodStart/periodEnd blindly forever.
        PekProgram program = createActiveProgram("2026-01-01", "2026-12-31", "Пыль", "мг/м3");
        PekReport report = createReport(program.getId(), 2026, 3);

        program.setValidUntil(LocalDate.parse("2026-06-30"));
        programRepository.save(program);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> collectionService.collect(report));
        assertEquals("PEK_PROGRAM_PERIOD_MISMATCH", ex.getCode());
    }

    // --- Task 5: company/object scope (parameter-substitution IDOR) ---

    @Test
    void createReport_withProgramFromAnotherCompany_isRejected() {
        Company otherCompany = new Company();
        otherCompany.setName("ТОО Другая компания Rec");
        otherCompany.setBin("770099998877");
        otherCompany.setLegalAddress("г. Астана");
        otherCompany.setPhone("+77009998866");
        otherCompany.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(otherCompany);
        CompanyObject otherObject = new CompanyObject();
        otherObject.setCompanyId(otherCompany.getId());
        otherObject.setName("Чужой объект Rec");
        otherObject.setAddress("г. Астана");
        otherObject.setStatus("ACTIVE");
        companyObjectRepository.save(otherObject);

        PekProgram otherProgram = new PekProgram();
        otherProgram.setCompanyId(otherCompany.getId());
        otherProgram.setObjectId(otherObject.getId());
        otherProgram.setNumber("OTHER-1");
        otherProgram.setName("Other Program");
        otherProgram.setValidFrom(LocalDate.parse("2026-01-01"));
        otherProgram.setValidUntil(LocalDate.parse("2026-12-31"));
        otherProgram.setStatus(PekProgramStatus.ACTIVE);
        otherProgram.setCreatedBy(1L);
        programRepository.save(otherProgram);

        // Claims companyId/objectId of the FIRST company while pointing programId at the SECOND
        // company's program - the exact parameter-substitution shape PekAccessService closes.
        var request = new PekApiDtos.CreateReportRequest(companyId, objectId, "QUARTER", 2026, 3, otherProgram.getId(), false);
        BadRequestException ex = assertThrows(BadRequestException.class, () -> reportService.create(request, 1L));
        assertEquals("PEK_PROGRAM_SCOPE_MISMATCH", ex.getCode());
    }

    @Test
    void accessService_requireCompanyMatches_rejectsMismatch() {
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> accessService.requireCompanyMatches(1L, 2L));
        assertEquals("PEK_COMPANY_MISMATCH", ex.getCode());
    }

    @Test
    void accessService_requireCompanyMatches_allowsNullClaim() {
        accessService.requireCompanyMatches(1L, null); // no exception - no claim to validate against
    }
}
