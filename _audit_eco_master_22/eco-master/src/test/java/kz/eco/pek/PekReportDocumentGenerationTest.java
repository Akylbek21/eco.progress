package kz.eco.pek;

import kz.eco.common.exception.ConflictException;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Iteration 3 of the PEK module overhaul: DOCX/PDF generation for a report's final document,
 * persisted as an immutable, ever-growing {@link PekReportDocumentVersion} history (never deleted
 * or overwritten - see {@link PekReportDocumentGenerationService}).
 */
@SpringBootTest
@Transactional
class PekReportDocumentGenerationTest {

    @Autowired private PekReportDocumentGenerationService generationService;
    @Autowired private PekReportDocumentVersionRepository versionRepository;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportPlanFactRowRepository planFactRowRepository;

    private Long reportId;
    private Long userId;

    @BeforeEach
    void setUp() {
        Company company = new Company();
        company.setName("PEK Docgen Test " + System.nanoTime());
        company.setBin(String.valueOf(700000000000L + Math.abs(System.nanoTime() % 200000000000L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);

        CompanyObject object = new CompanyObject();
        object.setCompanyId(company.getId());
        object.setName("Docgen Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);

        User head = new User();
        head.setEmail("pek-docgen-head-" + System.nanoTime() + "@test.kz");
        head.setPasswordHash("test");
        head.setName("Head");
        head.setRole(UserRole.HEAD);
        head.setType(ClientType.staff);
        userRepository.save(head);
        userId = head.getId();

        PekReport report = new PekReport();
        report.setCompanyId(company.getId());
        report.setObjectId(object.getId());
        report.setProgramId(1L);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(1);
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.DRAFT);
        report.setResponsibleUserId(head.getId());
        report.setCreatedBy(head.getId());
        report.computePeriodKey();
        reportRepository.saveAndFlush(report);
        reportId = report.getId();

        PekReportPlanFactRow row = new PekReportPlanFactRow();
        row.setReportId(reportId);
        row.setControlItemId(1L);
        row.setProgramIndicatorId(1L);
        row.setPlannedCount(1);
        row.setActualCount(1);
        row.setMissingCount(0);
        row.setCompletionPercent(BigDecimal.valueOf(100));
        row.setStatus(PekPlanFactRowStatus.COMPLETED);
        planFactRowRepository.saveAndFlush(row);
    }

    @Test
    void generateDocxCreatesFirstVersion() {
        PekReportDocumentVersion v = generationService.generateDocx(reportId, userId);
        assertEquals(1, v.getVersion());
        assertNotNull(v.getDocxFileId());
        assertNull(v.getPdfFileId());
        assertNotNull(v.getContentHash());
        assertNotNull(v.getSnapshotJson());
        assertTrue(v.getSnapshotJson().contains("reportNumber"));
    }

    @Test
    void generatePdfCreatesDocxAndPdf() {
        PekReportDocumentVersion v = generationService.generatePdf(reportId, userId);
        assertEquals(1, v.getVersion());
        assertNotNull(v.getDocxFileId());
        assertNotNull(v.getPdfFileId());
    }

    @Test
    void regenerationIncrementsVersionAndKeepsOldOnes() {
        PekReportDocumentVersion v1 = generationService.generateDocx(reportId, userId);
        PekReportDocumentVersion v2 = generationService.generateDocx(reportId, userId);
        assertEquals(1, v1.getVersion());
        assertEquals(2, v2.getVersion());

        List<PekReportDocumentVersion> versions = generationService.listVersions(reportId);
        assertEquals(2, versions.size());
        // v1 must still be retrievable, unmodified, after v2 was generated.
        assertNotNull(versionRepository.findById(v1.getId()).orElse(null));
        assertEquals(1, versionRepository.findById(v1.getId()).orElseThrow().getVersion());
    }

    @Test
    void regenerationBlockedOnceReportIsSigned() {
        generationService.generateDocx(reportId, userId);
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        report.setStatus(PekReportStatus.SIGNED);
        reportRepository.saveAndFlush(report);

        ConflictException ex = assertThrows(ConflictException.class,
                () -> generationService.generateDocx(reportId, userId));
        assertEquals("PEK_REPORT_DOCUMENT_LOCKED", ex.getCode());
    }

    @Test
    void regenerationBlockedOnceReportIsArchived() {
        generationService.generateDocx(reportId, userId);
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        report.setStatus(PekReportStatus.ARCHIVED);
        reportRepository.saveAndFlush(report);

        assertThrows(ConflictException.class, () -> generationService.generatePdf(reportId, userId));
    }
}
