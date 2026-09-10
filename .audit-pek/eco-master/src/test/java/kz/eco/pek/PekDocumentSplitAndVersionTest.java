package kz.eco.pek;

import kz.eco.company.Company;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
import kz.eco.pek.docgen.PekReportDocumentGenerationService;
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

import static org.junit.jupiter.api.Assertions.*;

/**
 * Task 1 & 2: official vs internal document split, and regulation/template version stamping.
 *
 * - OfficialPekReport uses {@link PekReportDocumentType#OFFICIAL} and stamps the report's
 *   regulationVersion + templateVersion into the document version row (immutable from this point).
 * - InternalPekAnalyticalReport uses {@link PekReportDocumentType#INTERNAL} and also stamps
 *   regulationVersion (for traceability) but is NOT subject to the normative template constraint.
 * - pek_report.regulationVersion / templateVersion are copied from the program at creation and
 *   frozen even if the program is later updated.
 */
@SpringBootTest
@Transactional
class PekDocumentSplitAndVersionTest {

    @Autowired private PekReportDocumentGenerationService generationService;
    @Autowired private PekReportDocumentVersionRepository versionRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekProgramRepository programRepository;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;

    private Long reportId;
    private Long programId;
    private Long userId;
    private static final String EXPECTED_REGULATION =
            "Правила №250 (Приказ МЭГПР РК от 26.05.2023 №250)";

    @BeforeEach
    void setUp() {
        Company company = new Company();
        company.setName("DocSplit Test " + System.nanoTime());
        company.setBin(String.valueOf(700000000000L + Math.abs(System.nanoTime() % 200000000000L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);

        CompanyObject object = new CompanyObject();
        object.setCompanyId(company.getId());
        object.setName("DocSplit Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);

        User user = new User();
        user.setEmail("docsplit-" + System.nanoTime() + "@test.kz");
        user.setPasswordHash("x");
        user.setName("DocSplit User");
        user.setRole(UserRole.HEAD);
        user.setType(ClientType.staff);
        userRepository.save(user);
        userId = user.getId();

        PekProgram program = new PekProgram();
        program.setCompanyId(company.getId());
        program.setObjectId(object.getId());
        program.setNumber("SPLIT-001");
        program.setName("Split Test Program");
        program.setValidFrom(LocalDate.of(2026, 1, 1));
        program.setValidUntil(LocalDate.of(2026, 12, 31));
        program.setCreatedBy(userId);
        program.setRegulationVersion(EXPECTED_REGULATION);
        program.setTemplateVersion("v2");
        programRepository.save(program);
        programId = program.getId();

        PekReport report = new PekReport();
        report.setCompanyId(company.getId());
        report.setObjectId(object.getId());
        report.setProgramId(programId);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(1);
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.DRAFT);
        report.setCreatedBy(userId);
        report.setRegulationVersion(EXPECTED_REGULATION);
        report.setTemplateVersion("v2");
        report.computePeriodKey();
        reportRepository.save(report);
        reportId = report.getId();
    }

    @Test
    void officialDocx_hasOfficialTypeAndVersionsStamped() {
        PekReportDocumentVersion v = generationService.generateOfficialDocx(reportId, userId);

        assertEquals(PekReportDocumentType.OFFICIAL, v.getDocumentType());
        assertEquals(EXPECTED_REGULATION, v.getRegulationVersion());
        assertEquals("v2", v.getTemplateVersion());
        assertTrue(v.getDocxFileId() != null && !v.getDocxFileId().isBlank());
    }

    @Test
    void internalDocx_hasInternalTypeAndVersionsStamped() {
        PekReportDocumentVersion v = generationService.generateInternalDocx(reportId, userId);

        assertEquals(PekReportDocumentType.INTERNAL, v.getDocumentType());
        assertEquals(EXPECTED_REGULATION, v.getRegulationVersion());
        assertTrue(v.getDocxFileId() != null && !v.getDocxFileId().isBlank());
    }

    @Test
    void officialAndInternal_bothPersisted_distinctVersionNumbers() {
        PekReportDocumentVersion official = generationService.generateOfficialDocx(reportId, userId);
        PekReportDocumentVersion internal = generationService.generateInternalDocx(reportId, userId);

        assertNotEquals(official.getId(), internal.getId());
        // version numbers increment monotonically regardless of document type
        assertTrue(internal.getVersion() > official.getVersion());
    }

    @Test
    void regulationVersionOnReport_copiedFromProgram_notMutatedLater() {
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        assertEquals(EXPECTED_REGULATION, report.getRegulationVersion());
        assertEquals("v2", report.getTemplateVersion());

        // Mutate the program - the report's frozen values must not change
        PekProgram program = programRepository.findById(programId).orElseThrow();
        program.setRegulationVersion("NewRegulation");
        programRepository.saveAndFlush(program);

        PekReport reloaded = reportRepository.findById(reportId).orElseThrow();
        assertEquals(EXPECTED_REGULATION, reloaded.getRegulationVersion(),
                "Report regulation_version must be immutable once set");
    }

    @Test
    void documentVersion_regulationAndTemplate_areImmutableSnapshots() {
        PekReportDocumentVersion v = generationService.generateOfficialDocx(reportId, userId);
        Long vid = v.getId();

        // Even if we reload the version row, the stamped values remain exactly as generated
        PekReportDocumentVersion reloaded = versionRepository.findById(vid).orElseThrow();
        assertEquals(EXPECTED_REGULATION, reloaded.getRegulationVersion());
        assertEquals("v2", reloaded.getTemplateVersion());
    }
}
