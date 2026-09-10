package kz.eco.pek;

import kz.eco.common.exception.ConflictException;
import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.pek.docgen.PekReportDocumentGenerationService;
import kz.eco.pek.dto.PekMonitoringDtos;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Task 4: monitoring as part of the PekProgram aggregate.
 *
 * - create/update/delete monitoring must supply If-Match: program.version (not monitoring.version)
 * - each mutation increments program.version AND contentRevision
 * - a previously generated document becomes stale after a monitoring mutation
 * - program readiness reflects monitoring completeness (NO_MONITORING_DIRECTIONS,
 *   INCOMPLETE_MONITORING issues)
 */
@SpringBootTest
@Transactional
class PekMonitoringAggregateTest {

    @Autowired private PekProgramMonitoringService monitoringService;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportDocumentVersionRepository documentVersionRepository;
    @Autowired private PekReportDocumentGenerationService documentGenerationService;
    @Autowired private PekProgramReadinessService readinessService;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;

    private Long programId;
    private Long reportId;
    private Long userId;
    private Long programVersion;

    @BeforeEach
    void setUp() {
        Company company = new Company();
        company.setName("Monitoring Aggregate Test " + System.nanoTime());
        company.setBin(String.valueOf(600000000000L + Math.abs(System.nanoTime() % 199999999999L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);

        CompanyObject object = new CompanyObject();
        object.setCompanyId(company.getId());
        object.setName("Aggregate Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);

        User user = new User();
        user.setEmail("mon-agg-" + System.nanoTime() + "@test.kz");
        user.setPasswordHash("x");
        user.setName("Aggregate User");
        user.setRole(UserRole.HEAD);
        user.setType(ClientType.staff);
        userRepository.save(user);
        userId = user.getId();

        PekProgram program = new PekProgram();
        program.setCompanyId(company.getId());
        program.setObjectId(object.getId());
        program.setNumber("AGG-001");
        program.setName("Aggregate Program");
        program.setValidFrom(LocalDate.of(2026, 1, 1));
        program.setValidUntil(LocalDate.of(2026, 12, 31));
        program.setCreatedBy(userId);
        programRepository.save(program);
        programId = program.getId();
        programVersion = program.getVersion();

        PekReport report = new PekReport();
        report.setCompanyId(company.getId());
        report.setObjectId(object.getId());
        report.setProgramId(programId);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(2);
        report.setPeriodStart(LocalDate.of(2026, 4, 1));
        report.setPeriodEnd(LocalDate.of(2026, 6, 30));
        report.setStatus(PekReportStatus.DRAFT);
        report.setCreatedBy(userId);
        report.computePeriodKey();
        reportRepository.save(report);
        reportId = report.getId();
    }

    @Test
    void createMonitoring_increments_programVersionAndContentRevision() {
        long contentBefore = programRepository.findById(programId).orElseThrow().getContentRevision();

        monitoringService.create(programId, monitoringRequest("AMBIENT_AIR"), programVersion);

        PekProgram after = programRepository.findById(programId).orElseThrow();
        assertTrue(after.getVersion() > programVersion, "program.version must increment on monitoring create");
        assertEquals(contentBefore + 1, after.getContentRevision(), "contentRevision must increment");
    }

    @Test
    void updateMonitoring_increments_programVersionAndContentRevision() {
        monitoringService.create(programId, monitoringRequest("AMBIENT_AIR"), programVersion);
        PekProgram afterCreate = programRepository.findById(programId).orElseThrow();
        Long monitoringId = monitoringService.list(programId).get(0).id();
        long contentBefore = afterCreate.getContentRevision();
        Long versionAfterCreate = afterCreate.getVersion();

        monitoringService.update(programId, monitoringId, monitoringRequest("AMBIENT_AIR"), versionAfterCreate);

        PekProgram after = programRepository.findById(programId).orElseThrow();
        assertTrue(after.getVersion() > versionAfterCreate);
        assertEquals(contentBefore + 1, after.getContentRevision());
    }

    @Test
    void deleteMonitoring_increments_programVersionAndContentRevision() {
        monitoringService.create(programId, monitoringRequest("SURFACE_WATER"), programVersion);
        PekProgram afterCreate = programRepository.findById(programId).orElseThrow();
        Long monitoringId = monitoringService.list(programId).get(0).id();
        long contentBefore = afterCreate.getContentRevision();
        Long versionAfterCreate = afterCreate.getVersion();

        monitoringService.delete(programId, monitoringId, versionAfterCreate);

        PekProgram after = programRepository.findById(programId).orElseThrow();
        assertTrue(after.getVersion() > versionAfterCreate);
        assertEquals(contentBefore + 1, after.getContentRevision());
    }

    @Test
    void createMonitoring_wrongProgramVersion_throwsConflict() {
        assertThrows(ConflictException.class,
                () -> monitoringService.create(programId, monitoringRequest("AMBIENT_AIR"), 99999L));
    }

    @Test
    void afterMonitoringCreate_generatedDocument_becomesStale() {
        // Generate a document before mutating monitoring
        PekReportDocumentVersion before = documentGenerationService.generateOfficialDocx(reportId, userId);
        assertFalse(isStale(before), "freshly generated document must not be stale");

        // Mutate monitoring → bumps contentRevision
        monitoringService.create(programId, monitoringRequest("AMBIENT_AIR"), programVersion);

        // Reload the report to check its current contentRevision
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        PekReportDocumentVersion reloaded = documentVersionRepository.findById(before.getId()).orElseThrow();
        boolean stale = reloaded.getSourceContentRevision() != null
                && !reloaded.getSourceContentRevision().equals(report.getContentRevision());
        assertTrue(stale, "document must be stale after monitoring mutation increments contentRevision");
    }

    @Test
    void readiness_withNoMonitoring_hasNoMonitoringIssue() {
        PekProgram program = programRepository.findById(programId).orElseThrow();
        var readiness = readinessService.evaluate(program);

        boolean hasMonitoringIssue = readiness.issues().stream()
                .anyMatch(i -> "NO_MONITORING_DIRECTIONS".equals(i.code()));
        assertTrue(hasMonitoringIssue, "readiness must flag NO_MONITORING_DIRECTIONS when monitoring list is empty");
    }

    @Test
    void readiness_withCompleteMonitoring_noMonitoringIssues() {
        // Create a monitoring direction with all required fields
        PekMonitoringDtos.Request req = new PekMonitoringDtos.Request(
                "AMBIENT_AIR", "Атмосферный воздух", "ГОСТ Р 59055-2020",
                null, "QUARTERLY", 4, List.of(), true);
        monitoringService.create(programId, req, programVersion);

        PekProgram program = programRepository.findById(programId).orElseThrow();
        var readiness = readinessService.evaluate(program);

        boolean hasNoMonitoring = readiness.issues().stream()
                .anyMatch(i -> "NO_MONITORING_DIRECTIONS".equals(i.code()));
        assertFalse(hasNoMonitoring, "must not flag NO_MONITORING_DIRECTIONS when a direction exists");
    }

    @Test
    void readiness_withIncompleteMonitoring_flagsIncompleteIssue() {
        // Create a monitoring direction without methodology and frequencyType
        PekMonitoringDtos.Request req = new PekMonitoringDtos.Request(
                "AMBIENT_AIR", "Атмосферный воздух", null,
                null, null, null, List.of(), true);
        monitoringService.create(programId, req, programVersion);

        PekProgram program = programRepository.findById(programId).orElseThrow();
        var readiness = readinessService.evaluate(program);

        boolean hasIncomplete = readiness.issues().stream()
                .anyMatch(i -> "INCOMPLETE_MONITORING".equals(i.code()));
        assertTrue(hasIncomplete, "readiness must flag INCOMPLETE_MONITORING when fields are missing");
    }

    private static PekMonitoringDtos.Request monitoringRequest(String type) {
        return new PekMonitoringDtos.Request(type, null, null, null, null, null, List.of(), true);
    }

    private boolean isStale(PekReportDocumentVersion v) {
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        return v.getSourceContentRevision() != null
                && !v.getSourceContentRevision().equals(report.getContentRevision());
    }
}
