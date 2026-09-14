package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.pek.dto.PekApiDtos;
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

    /** Same ceiling the permit-file endpoint uses - a submission receipt is a scan, not an archive. */
    private static final long MAX_CONFIRMATION_FILE_BYTES = 25L * 1024 * 1024;

    private final PekReportRepository reportRepository;
    private final PekReportDocumentVersionRepository documentVersionRepository;
    private final kz.eco.storage.FileStorageService fileStorageService;

    public PekReportSubmissionService(PekReportRepository reportRepository,
                                      PekReportDocumentVersionRepository documentVersionRepository,
                                      kz.eco.storage.FileStorageService fileStorageService) {
        this.reportRepository = reportRepository;
        this.documentVersionRepository = documentVersionRepository;
        this.fileStorageService = fileStorageService;
    }

    /**
     * Stores the scan/receipt proving submission and returns its stored-file id (item 24).
     * Reuses the module's existing storage and the same content validator the program-document
     * and permit uploads use, rather than introducing a second file path: the validator rejects
     * disguised executables and mismatched content types, which is exactly what must not be
     * bypassed for a file an auditor will later download.
     *
     * <p>The caller must already have passed the report's company-scope check - the returned id is
     * only ever attached to that report by {@link #recordOfficialSubmission}.
     */
    @Transactional
    public PekApiDtos.PermitFileUploadResponse uploadConfirmationFile(
            Long reportId, org.springframework.web.multipart.MultipartFile file, Long actorUserId)
            throws java.io.IOException {
        PekReport report = load(reportId);
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не передан", "PEK_SUBMISSION_FILE_MISSING");
        }
        if (file.getSize() > MAX_CONFIRMATION_FILE_BYTES) {
            throw new kz.eco.common.exception.PayloadTooLargeException(
                    "Размер файла превышает допустимый лимит "
                            + (MAX_CONFIRMATION_FILE_BYTES / (1024 * 1024)) + " МБ");
        }
        byte[] content = file.getBytes();
        PekProgramDocumentFileValidator.validate(file.getOriginalFilename(), file.getContentType(), content);
        kz.eco.storage.StoredFileMetadata stored = fileStorageService.storeBytes(
                content, file.getOriginalFilename(), file.getContentType(),
                "pek-report-submission-" + report.getId(), String.valueOf(actorUserId));
        return new PekApiDtos.PermitFileUploadResponse(
                stored.fileId(), stored.filename(), stored.contentType(), stored.size());
    }

    /**
     * Loads the submission-confirmation scan. The fileId is read from the persisted report row,
     * never taken from the caller - so knowing another company's fileId grants nothing, and the
     * caller's company scope has already been checked against THIS report by the controller.
     * Mirrors {@link PekPermitService#downloadFile} exactly.
     */
    @Transactional(readOnly = true)
    public kz.eco.storage.StoredFileContent downloadConfirmationFile(Long reportId) {
        PekReport report = load(reportId);
        String fileId = report.getConfirmationFileId();
        if (fileId == null || fileId.isBlank()) {
            throw new NotFoundException("К отчёту не прикреплён подтверждающий файл сдачи: " + reportId);
        }
        try {
            return fileStorageService.load(fileId);
        } catch (java.io.IOException ex) {
            throw new NotFoundException("Подтверждающий файл недоступен: " + reportId);
        }
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

    /**
     * Records the OFFICIAL submission details (module spec P1, items 22-26): where/when/how the
     * signed report was actually filed with the regulator, its registration number and the scan
     * proving it.
     *
     * <p>Deliberately NOT a status transition (item 23): the internal SIGNED → SUBMITTED move
     * stays {@link #submit}. A report may be filed and only afterwards have its receipt number
     * typed in, and a wrong number must be correctable without walking the status machine
     * backwards - so this method is idempotent-by-overwrite and records
     * submissionRecordedAt once, submissionUpdatedAt on every subsequent correction.
     *
     * <p>There is no automatic push to a government portal: no official external API exists, so
     * this is a human attesting to what they did (item 21).
     *
     * @param confirmationFileId a stored-file id produced by this module's own upload endpoint,
     *                           never a raw client-supplied id for an arbitrary file.
     */
    @Transactional
    public PekReport recordOfficialSubmission(Long reportId, Long ifMatchVersion,
                                              PekSubmissionMethod method,
                                              String registrationNumber,
                                              String comment,
                                              String confirmationFileId,
                                              LocalDateTime submittedAt,
                                              Long actorUserId) {
        if (method == null) {
            throw new BadRequestException("Укажите способ сдачи (submissionMethod)",
                    "PEK_SUBMISSION_METHOD_REQUIRED");
        }
        PekReport report = load(reportId);
        checkVersion(report, ifMatchVersion);

        // Item 25: only a report that has actually been signed and filed can carry filing details.
        // Recording them for a DRAFT would assert to an auditor that an unsigned report was handed
        // to the regulator.
        if (!ALLOWS_SUBMISSION_RECORD.contains(report.getStatus())) {
            throw new BadRequestException(
                    "Зафиксировать сдачу можно только для подписанного отчёта (SIGNED, SUBMITTED, "
                            + "ACCEPTED или REJECTED). Текущий статус: " + report.getStatus(),
                    "PEK_SUBMISSION_INVALID_STATUS");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime effectiveSubmittedAt = submittedAt != null ? submittedAt : now;
        if (effectiveSubmittedAt.isAfter(now)) {
            throw new BadRequestException("Дата сдачи не может быть в будущем",
                    "PEK_SUBMISSION_DATE_IN_FUTURE");
        }

        report.setSubmissionMethod(method);
        report.setRegistrationNumber(trimToNull(registrationNumber));
        report.setSubmissionComment(trimToNull(comment));
        if (confirmationFileId != null) {
            report.setConfirmationFileId(trimToNull(confirmationFileId));
        }
        report.setSubmittedAt(effectiveSubmittedAt);
        report.setSubmittedBy(actorUserId);
        if (report.getSubmissionRecordedAt() == null) {
            report.setSubmissionRecordedAt(now);
        } else {
            report.setSubmissionUpdatedAt(now);
        }
        return reportRepository.saveAndFlush(report);
    }

    /** Statuses in which a report has demonstrably been signed, so filing details are meaningful. */
    private static final java.util.Set<PekReportStatus> ALLOWS_SUBMISSION_RECORD = java.util.EnumSet.of(
            PekReportStatus.SIGNED, PekReportStatus.SUBMITTED,
            PekReportStatus.ACCEPTED, PekReportStatus.REJECTED);

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
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
