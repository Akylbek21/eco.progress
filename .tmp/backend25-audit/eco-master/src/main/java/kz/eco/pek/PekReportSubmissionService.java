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
    private final PekReportSignatureRepository signatureRepository;
    private final PekReportContentRevisionService contentRevisionService;
    private final PekReportWorkflowHistoryRepository historyRepository;

    public PekReportSubmissionService(PekReportRepository reportRepository,
                                      PekReportDocumentVersionRepository documentVersionRepository,
                                      kz.eco.storage.FileStorageService fileStorageService,
                                      PekReportSignatureRepository signatureRepository,
                                      PekReportContentRevisionService contentRevisionService,
                                      PekReportWorkflowHistoryRepository historyRepository) {
        this.reportRepository = reportRepository;
        this.documentVersionRepository = documentVersionRepository;
        this.fileStorageService = fileStorageService;
        this.signatureRepository = signatureRepository;
        this.contentRevisionService = contentRevisionService;
        this.historyRepository = historyRepository;
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

    /** Filing details of an official submission, already parsed/typed by the controller. */
    public record OfficialSubmissionDetails(
            LocalDateTime submittedAt,
            PekSubmissionMethod method,
            String registrationNumber,
            String confirmationFileId,
            String comment
    ) {
    }

    /** Methods where the regulator's system issues a receipt number that must be recorded. */
    private static final java.util.Set<PekSubmissionMethod> REGISTRATION_NUMBER_REQUIRED =
            java.util.EnumSet.of(PekSubmissionMethod.ECO_PORTAL, PekSubmissionMethod.EGOV_PORTAL);

    private static final int MAX_REGISTRATION_NUMBER = 120;
    private static final int MAX_COMMENT = 2000;

    /**
     * SIGNED → SUBMITTED together with the official filing details (one atomic operation - a
     * report can no longer become SUBMITTED without saying where, when and how it was filed).
     *
     * <p>Preconditions, all server-side: If-Match; status SIGNED (i.e. approved and signed);
     * the latest OFFICIAL document exists, is not stale against the report's contentRevision
     * and carries a verified signature for exactly that document version; a confirmation file, if
     * given, was uploaded for THIS report. Writes a workflow-history entry without any signature
     * content.
     */
    @Transactional
    public PekReport submit(Long reportId, Long ifMatchVersion, OfficialSubmissionDetails details, Long actorUserId) {
        if (details == null) {
            throw new BadRequestException("Для сдачи отчёта укажите реквизиты официальной сдачи "
                    + "(submittedAt, submissionMethod, registrationNumber)", "PEK_SUBMISSION_DETAILS_REQUIRED");
        }
        PekReport report = load(reportId);
        checkVersion(report, ifMatchVersion);
        requireTransition(report, PekReportStatus.SUBMITTED);
        PekReportSignature signature = requireSignedCurrentOfficialDocument(report);
        validateDetails(details, signature);
        String fileId = trimToNull(details.confirmationFileId());
        if (fileId != null) {
            requireConfirmationFileOfReport(fileId, reportId);
        }

        PekReportStatus before = report.getStatus();
        Long versionBefore = report.getVersion();
        LocalDateTime now = LocalDateTime.now();
        report.setStatus(PekReportStatus.SUBMITTED);
        report.setSubmissionMethod(details.method());
        report.setRegistrationNumber(trimToNull(details.registrationNumber()));
        report.setSubmissionComment(trimToNull(details.comment()));
        report.setConfirmationFileId(fileId);
        report.setSubmittedAt(details.submittedAt());
        report.setSubmittedBy(actorUserId);
        if (report.getSubmissionRecordedAt() == null) {
            report.setSubmissionRecordedAt(now);
        } else {
            report.setSubmissionUpdatedAt(now);
        }
        report.setUpdatedAt(now);
        PekReport saved = reportRepository.saveAndFlush(report);
        writeHistory(saved, before, "SUBMIT", versionBefore, actorUserId,
                "Сдан: " + details.method() + ", рег. № " + nz(saved.getRegistrationNumber())
                        + ", дата " + details.submittedAt()
                        + (fileId != null ? ", подтверждающий файл приложен" : ""));
        return saved;
    }

    /** true when {@link #submit} would pass its document checks for this report (used by
     *  availableActions so the flag never enables a call the endpoint then rejects). */
    @Transactional(readOnly = true)
    public boolean hasSignedCurrentOfficialDocument(PekReport report) {
        var latest = documentVersionRepository.findTopByReportIdAndDocumentTypeOrderByVersionDesc(
                report.getId(), PekReportDocumentType.OFFICIAL);
        if (latest.isEmpty() || isStale(latest.get(), report)) {
            return false;
        }
        return signatureRepository.findTopByReportIdAndDocumentVersionIdAndVerifiedTrueOrderBySignedAtDesc(
                report.getId(), latest.get().getId()).isPresent();
    }

    private PekReportSignature requireSignedCurrentOfficialDocument(PekReport report) {
        Long reportId = report.getId();
        // Blocker 3: what is handed to the state authority is the OFFICIAL document - an INTERNAL
        // analytical document must never be submittable even if the report reached SIGNED.
        PekReportDocumentVersion official = documentVersionRepository
                .findTopByReportIdAndDocumentTypeOrderByVersionDesc(reportId, PekReportDocumentType.OFFICIAL)
                .orElseThrow(() -> new BadRequestException(
                        "Для отчёта не сформирован официальный документ - внутренний аналитический отчёт "
                                + "нельзя сдать в госорган",
                        "PEK_REPORT_NO_OFFICIAL_DOCUMENT"));
        contentRevisionService.requireCurrent(official.getSourceContentRevision(), report);
        return signatureRepository
                .findTopByReportIdAndDocumentVersionIdAndVerifiedTrueOrderBySignedAtDesc(reportId, official.getId())
                .orElseThrow(() -> new ConflictException(
                        "Актуальная версия официального документа не подписана - сдать можно только "
                                + "подписанный документ", "PEK_DOCUMENT_NOT_SIGNED"));
    }

    private static boolean isStale(PekReportDocumentVersion version, PekReport report) {
        return version.getSourceContentRevision() != null
                && !version.getSourceContentRevision().equals(report.getContentRevision());
    }

    private static void validateDetails(OfficialSubmissionDetails details, PekReportSignature signature) {
        java.util.Map<String, String> errors = new java.util.LinkedHashMap<>();
        if (details.method() == null) {
            errors.put("submissionMethod", "Укажите способ сдачи");
        }
        if (details.submittedAt() == null) {
            errors.put("submittedAt", "Укажите дату и время сдачи");
        } else {
            if (details.submittedAt().isAfter(LocalDateTime.now())) {
                errors.put("submittedAt", "Дата сдачи не может быть в будущем");
            }
            if (signature.getSignedAt() != null && details.submittedAt().isBefore(signature.getSignedAt())) {
                errors.put("submittedAt", "Дата сдачи не может быть раньше подписания документа");
            }
        }
        String registration = trimToNull(details.registrationNumber());
        if (details.method() != null && REGISTRATION_NUMBER_REQUIRED.contains(details.method()) && registration == null) {
            errors.put("registrationNumber", "Для сдачи через портал укажите регистрационный номер");
        }
        if (registration != null && registration.length() > MAX_REGISTRATION_NUMBER) {
            errors.put("registrationNumber", "Не более " + MAX_REGISTRATION_NUMBER + " символов");
        }
        if (details.method() == PekSubmissionMethod.OTHER && trimToNull(details.comment()) == null) {
            errors.put("comment", "Для способа OTHER опишите способ сдачи в комментарии");
        }
        if (details.comment() != null && details.comment().length() > MAX_COMMENT) {
            errors.put("comment", "Не более " + MAX_COMMENT + " символов");
        }
        if (!errors.isEmpty()) {
            throw new kz.eco.common.exception.ValidationException("Некорректные реквизиты сдачи отчёта", errors);
        }
    }

    /** The file must have been stored by {@link #uploadConfirmationFile} for THIS report - that
     *  upload already enforced type/size/content validation and the report's company scope. A
     *  fileId from any other context (another report/company/module) is refused. */
    private void requireConfirmationFileOfReport(String fileId, Long reportId) {
        kz.eco.storage.FileStorageService.FileOwnership ownership;
        try {
            ownership = fileStorageService.loadOwnership(fileId);
        } catch (java.io.IOException | NotFoundException e) {
            throw new BadRequestException("Подтверждающий файл не найден: " + fileId, "PEK_SUBMISSION_FILE_NOT_FOUND");
        }
        if (!confirmationContext(reportId).equals(ownership.contextId())) {
            throw new BadRequestException("Подтверждающий файл не относится к этому отчёту",
                    "PEK_SUBMISSION_FILE_FOREIGN");
        }
    }

    private static String confirmationContext(Long reportId) {
        return "pek-report-submission-" + reportId;
    }

    private void writeHistory(PekReport report, PekReportStatus from, String action, Long versionBefore,
                              Long actorUserId, String comment) {
        if (actorUserId == null) {
            return;
        }
        PekReportWorkflowHistory h = new PekReportWorkflowHistory();
        h.setReportId(report.getId());
        h.setFromStatus(from);
        h.setToStatus(report.getStatus());
        h.setAction(action);
        h.setComment(comment != null && comment.length() > 2000 ? comment.substring(0, 2000) : comment);
        h.setPerformedBy(actorUserId);
        h.setVersionBefore(versionBefore);
        h.setVersionAfter(report.getVersion());
        historyRepository.save(h);
    }

    private static Long currentUserId() {
        kz.eco.user.User user = kz.eco.auth.CurrentUser.getOrNull();
        return user == null ? null : user.getId();
    }

    private static String nz(String value) {
        return value == null ? "—" : value;
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
        if (trimToNull(confirmationFileId) != null) {
            requireConfirmationFileOfReport(confirmationFileId.trim(), reportId);
            report.setConfirmationFileId(confirmationFileId.trim());
        }
        report.setSubmittedAt(effectiveSubmittedAt);
        report.setSubmittedBy(actorUserId);
        if (report.getSubmissionRecordedAt() == null) {
            report.setSubmissionRecordedAt(now);
        } else {
            report.setSubmissionUpdatedAt(now);
        }
        Long versionBefore = report.getVersion();
        PekReport saved = reportRepository.saveAndFlush(report);
        writeHistory(saved, saved.getStatus(), "SUBMISSION_DETAILS", versionBefore, actorUserId,
                "Реквизиты сдачи: " + method + ", рег. № " + nz(saved.getRegistrationNumber()));
        return saved;
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
        PekReportStatus before = report.getStatus();
        Long versionBefore = report.getVersion();
        report.setStatus(PekReportStatus.ACCEPTED);
        report.setAcceptedAt(LocalDateTime.now());
        PekReport saved = reportRepository.saveAndFlush(report);
        writeHistory(saved, before, "ACCEPT", versionBefore, currentUserId(), null);
        return saved;
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
        PekReportStatus before = report.getStatus();
        Long versionBefore = report.getVersion();
        report.setStatus(PekReportStatus.REJECTED);
        report.setRejectedAt(LocalDateTime.now());
        report.setRejectionReason(rejectionReason.trim());
        PekReport saved = reportRepository.saveAndFlush(report);
        writeHistory(saved, before, "REJECT", versionBefore, currentUserId(), saved.getRejectionReason());
        return saved;
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
