package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Manages the post-signing submission lifecycle: SIGNED → SUBMITTED → ACCEPTED | REJECTED.
 * Each state transition is a discrete operation with its own timestamp (submittedAt, acceptedAt,
 * rejectedAt) and, for rejection, a mandatory reason. All three operations require optimistic
 * locking via the report's JPA version (passed as the If-Match header value by the controller).
 */
@Service
public class PekReportSubmissionService {

    private final PekReportRepository reportRepository;
    private final PekReportDocumentVersionRepository documentVersionRepository;

    public PekReportSubmissionService(PekReportRepository reportRepository,
                                      PekReportDocumentVersionRepository documentVersionRepository) {
        this.reportRepository = reportRepository;
        this.documentVersionRepository = documentVersionRepository;
    }

    /** SIGNED → SUBMITTED. Stamped submittedAt. */
    @Transactional
    public PekReport submit(Long reportId, Long ifMatchVersion) {
        PekReport report = load(reportId);
        checkVersion(report, ifMatchVersion);
        requireTransition(report, PekReportStatus.SUBMITTED);
        // Blocker 3: what is handed to the state authority is the OFFICIAL document. Signing
        // already refuses to sign anything else, but an INTERNAL analytical document must never be
        // submittable even if the report reached SIGNED by some other route.
        if (!documentVersionRepository.existsByReportIdAndDocumentType(reportId, PekReportDocumentType.OFFICIAL)) {
            throw new BadRequestException(
                    "Для отчёта не сформирован официальный документ - внутренний аналитический отчёт "
                            + "нельзя сдать в госорган",
                    "PEK_REPORT_NO_OFFICIAL_DOCUMENT");
        }
        report.setStatus(PekReportStatus.SUBMITTED);
        report.setSubmittedAt(LocalDateTime.now());
        return reportRepository.saveAndFlush(report);
    }

    /** SUBMITTED → ACCEPTED. Stamped acceptedAt. */
    @Transactional
    public PekReport accept(Long reportId, Long ifMatchVersion) {
        PekReport report = load(reportId);
        checkVersion(report, ifMatchVersion);
        requireTransition(report, PekReportStatus.ACCEPTED);
        report.setStatus(PekReportStatus.ACCEPTED);
        report.setAcceptedAt(LocalDateTime.now());
        return reportRepository.saveAndFlush(report);
    }

    /** SUBMITTED → REJECTED. Stamped rejectedAt + rejectionReason (mandatory). */
    @Transactional
    public PekReport reject(Long reportId, Long ifMatchVersion, String rejectionReason) {
        if (rejectionReason == null || rejectionReason.isBlank()) {
            throw new BadRequestException("Причина отказа обязательна", "REJECTION_REASON_REQUIRED");
        }
        PekReport report = load(reportId);
        checkVersion(report, ifMatchVersion);
        requireTransition(report, PekReportStatus.REJECTED);
        report.setStatus(PekReportStatus.REJECTED);
        report.setRejectedAt(LocalDateTime.now());
        report.setRejectionReason(rejectionReason.trim());
        return reportRepository.saveAndFlush(report);
    }

    private PekReport load(Long reportId) {
        return reportRepository.findById(reportId)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + reportId));
    }

    private void checkVersion(PekReport report, Long expected) {
        if (expected == null) {
            throw new BadRequestException("Требуется заголовок If-Match", "VERSION_REQUIRED");
        }
        if (!expected.equals(report.getVersion())) {
            throw ConflictException.versionConflict("Данные изменены другим сотрудником — обновите страницу", "PEK_VERSION_CONFLICT", report.getVersion());
        }
    }

    private void requireTransition(PekReport report, PekReportStatus target) {
        if (!report.getStatus().canTransitionTo(target)) {
            throw new ConflictException(
                    "Переход " + report.getStatus() + " → " + target + " недопустим",
                    "PEK_REPORT_INVALID_TRANSITION");
        }
    }
}
