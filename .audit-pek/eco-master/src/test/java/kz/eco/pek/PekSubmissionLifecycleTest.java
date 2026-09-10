package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.company.Company;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.company.CompanyObject;
import kz.eco.company.CompanyObjectRepository;
import kz.eco.company.CompanyRepository;
import kz.eco.company.CompanyStatus;
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
 * Task 3: submission lifecycle - SIGNED → SUBMITTED → ACCEPTED | REJECTED.
 * Also verifies submissionDueDate is calculated correctly and independently from periodEnd
 * and program.validUntil.
 */
@SpringBootTest
@Transactional
class PekSubmissionLifecycleTest {

    @Autowired private PekReportSubmissionService submissionService;
    @Autowired private PekReportRepository reportRepository;
    @Autowired private PekReportService reportService;
    @Autowired private PekSubmissionDeadlineService deadlineCalculator;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private CompanyObjectRepository companyObjectRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PekReportDocumentVersionRepository documentVersionRepository;

    private Long reportId;
    private Long userId;

    @BeforeEach
    void setUp() {
        Company company = new Company();
        company.setName("Submission Test " + System.nanoTime());
        company.setBin(String.valueOf(700000000000L + Math.abs(System.nanoTime() % 200000000000L)));
        company.setStatus(CompanyStatus.ACTIVE);
        companyRepository.save(company);

        CompanyObject object = new CompanyObject();
        object.setCompanyId(company.getId());
        object.setName("Submission Object");
        object.setStatus("ACTIVE");
        companyObjectRepository.save(object);

        User user = new User();
        user.setEmail("submission-" + System.nanoTime() + "@test.kz");
        user.setPasswordHash("x");
        user.setName("Submission User");
        user.setRole(UserRole.HEAD);
        user.setType(ClientType.staff);
        userRepository.save(user);
        userId = user.getId();

        PekReport report = new PekReport();
        report.setCompanyId(company.getId());
        report.setObjectId(object.getId());
        report.setProgramId(1L);
        report.setPeriodType(PekPeriodType.QUARTER);
        report.setReportYear(2026);
        report.setReportQuarter(1);
        report.setPeriodStart(LocalDate.of(2026, 1, 1));
        report.setPeriodEnd(LocalDate.of(2026, 3, 31));
        report.setStatus(PekReportStatus.SIGNED);
        report.setCreatedBy(userId);
        report.setSubmissionDueDate(LocalDate.of(2026, 5, 1));
        report.computePeriodKey();
        reportRepository.save(report);
        reportId = report.getId();

        // submit() now requires a real OFFICIAL document version to exist (blocker 3: an INTERNAL
        // analytical report may never be handed to the state authority).
        PekReportDocumentVersion official = new PekReportDocumentVersion();
        official.setReportId(reportId);
        official.setVersion(1);
        official.setDocumentType(PekReportDocumentType.OFFICIAL);
        official.setSnapshotJson("{}");
        official.setContentHash("0".repeat(64));
        official.setGeneratedBy(userId);
        official.setGeneratedAt(java.time.LocalDateTime.now());
        documentVersionRepository.saveAndFlush(official);
    }

    @Test
    void submissionDueDate_quarterly_isFirstDayOfSecondMonthAfterQuarter() {
        LocalDate periodEnd = LocalDate.of(2026, 3, 31);
        LocalDate due = deadlineCalculator.calculate(PekReportType.PEK_QUARTERLY, PekRegulationVersionService.PEK_RULES_250_2026_59, periodEnd);
        assertEquals(LocalDate.of(2026, 5, 1), due);
    }

    @Test
    void submissionDueDate_annualTables7And12_isFirstDayOfThirdMonthAfterPeriod() {
        LocalDate periodEnd = LocalDate.of(2025, 12, 31);
        LocalDate due = deadlineCalculator.calculate(PekReportType.PEK_TABLES_7_12_ANNUAL,
                PekRegulationVersionService.PEK_RULES_250_2026_59, periodEnd);
        // Calendar rule, not the old plusDays(45) which landed on 14.02 and drifted with the year.
        assertEquals(LocalDate.of(2026, 3, 1), due);
    }

    @Test
    void submissionDueDate_independentOfProgramValidUntil() {
        // periodEnd = 2026-03-31, program.validUntil = 2026-06-30 (different) - deadline depends
        // only on periodEnd, never on program.validUntil
        LocalDate periodEnd = LocalDate.of(2026, 3, 31);
        LocalDate due = deadlineCalculator.calculate(PekReportType.PEK_QUARTERLY, PekRegulationVersionService.PEK_RULES_250_2026_59, periodEnd);
        // Due = 1st day of the second month after the quarter = 2026-05-01, not tied to any program date
        assertEquals(periodEnd.plusMonths(2).withDayOfMonth(1), due);
    }

    /** Contract: the submission lifecycle fields reach the API DTO (list and detail share the same
     *  mapper), ISO-formatted, and stay null until their transition has happened. */
    @Test
    void reportResponse_exposesSubmissionLifecycleFields() {
        PekReport report = reportRepository.findById(reportId).orElseThrow();

        PekApiDtos.ReportResponse draft = reportService.get(reportId);
        assertEquals(report.getSubmissionDueDate().toString(), draft.submissionDueDate());
        assertNull(draft.submittedAt());
        assertNull(draft.acceptedAt());
        assertNull(draft.rejectedAt());
        assertNull(draft.rejectionReason());

        PekReport submitted = submissionService.submit(reportId, report.getVersion());
        PekApiDtos.ReportResponse afterSubmit = reportService.get(reportId);
        assertEquals(submitted.getSubmittedAt().toString(), afterSubmit.submittedAt());
        assertNull(afterSubmit.acceptedAt());

        // The same mapper backs the list endpoint, so the fields are present there too.
        PekApiDtos.ReportResponse listed = reportService
                .listForObject(report.getCompanyId(), report.getObjectId()).stream()
                .filter(r -> r.id().equals(reportId)).findFirst().orElseThrow();
        assertEquals(afterSubmit.submittedAt(), listed.submittedAt());

        PekReport rejected = submissionService.reject(reportId, afterSubmit.version(), "Неверный формат");
        PekApiDtos.ReportResponse afterReject = reportService.get(reportId);
        assertEquals(rejected.getRejectedAt().toString(), afterReject.rejectedAt());
        assertEquals("Неверный формат", afterReject.rejectionReason());
        assertNull(afterReject.acceptedAt());
    }

    @Test
    void submit_signedToSubmitted_stampsSubmittedAt() {
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        Long version = report.getVersion();

        PekReport updated = submissionService.submit(reportId, version);

        assertEquals(PekReportStatus.SUBMITTED, updated.getStatus());
        assertNotNull(updated.getSubmittedAt());
        assertNull(updated.getAcceptedAt());
        assertNull(updated.getRejectedAt());
    }

    @Test
    void accept_submittedToAccepted_stampsAcceptedAt() {
        // First submit
        PekReport after = submissionService.submit(reportId,
                reportRepository.findById(reportId).orElseThrow().getVersion());

        PekReport accepted = submissionService.accept(reportId, after.getVersion());

        assertEquals(PekReportStatus.ACCEPTED, accepted.getStatus());
        assertNotNull(accepted.getAcceptedAt());
        assertNull(accepted.getRejectedAt());
    }

    @Test
    void reject_submittedToRejected_stampsRejectedAtAndReason() {
        PekReport after = submissionService.submit(reportId,
                reportRepository.findById(reportId).orElseThrow().getVersion());

        PekReport rejected = submissionService.reject(reportId, after.getVersion(), "Неверный формат");

        assertEquals(PekReportStatus.REJECTED, rejected.getStatus());
        assertNotNull(rejected.getRejectedAt());
        assertEquals("Неверный формат", rejected.getRejectionReason());
    }

    @Test
    void reject_withoutReason_throwsBadRequest() {
        PekReport after = submissionService.submit(reportId,
                reportRepository.findById(reportId).orElseThrow().getVersion());
        assertThrows(BadRequestException.class,
                () -> submissionService.reject(reportId, after.getVersion(), ""));
    }

    @Test
    void submit_withOnlyInternalDocument_isRejected() {
        // Blocker 3: replace the OFFICIAL version with an INTERNAL one - an internal analytical
        // report must never be submittable to the state authority.
        documentVersionRepository.deleteAll(documentVersionRepository.findByReportIdOrderByVersionDesc(reportId));
        PekReportDocumentVersion internal = new PekReportDocumentVersion();
        internal.setReportId(reportId);
        internal.setVersion(1);
        internal.setDocumentType(PekReportDocumentType.INTERNAL);
        internal.setSnapshotJson("{}");
        internal.setContentHash("1".repeat(64));
        internal.setGeneratedBy(userId);
        internal.setGeneratedAt(java.time.LocalDateTime.now());
        documentVersionRepository.saveAndFlush(internal);

        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> submissionService.submit(reportId,
                        reportRepository.findById(reportId).orElseThrow().getVersion()));
        assertEquals("PEK_REPORT_NO_OFFICIAL_DOCUMENT", ex.getCode());
        assertEquals(PekReportStatus.SIGNED, reportRepository.findById(reportId).orElseThrow().getStatus());
    }

    @Test
    void submit_wrongVersion_throwsConflict() {
        assertThrows(ConflictException.class,
                () -> submissionService.submit(reportId, 99999L));
    }

    @Test
    void submit_fromDraft_throwsConflict() {
        PekReport report = reportRepository.findById(reportId).orElseThrow();
        report.setStatus(PekReportStatus.DRAFT);
        reportRepository.saveAndFlush(report);
        PekReport reloaded = reportRepository.findById(reportId).orElseThrow();

        assertThrows(ConflictException.class,
                () -> submissionService.submit(reportId, reloaded.getVersion()));
    }

    @Test
    void accepted_cannotBeSubmittedAgain() {
        PekReport afterSubmit = submissionService.submit(reportId,
                reportRepository.findById(reportId).orElseThrow().getVersion());
        PekReport afterAccept = submissionService.accept(reportId, afterSubmit.getVersion());

        assertThrows(ConflictException.class,
                () -> submissionService.submit(reportId, afterAccept.getVersion()));
    }
}
