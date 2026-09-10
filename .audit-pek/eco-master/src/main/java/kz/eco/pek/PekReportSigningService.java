package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.ConflictException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.signature.EdsSigningPolicyService;
import kz.eco.signature.SignatureInfo;
import kz.eco.signature.SignatureVerificationService;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileMetadata;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;

/**
 * Signs a PEK final report (Iteration 3 of the PEK module overhaul), reusing the project's real
 * CMS/ЭЦП verification infrastructure exactly the way kz.eco.protocol.ProtocolService#sign does:
 * verify the CMS against the actual generated PDF bytes via
 * {@link SignatureVerificationService#verifyDocument} BEFORE persisting any signed state - a
 * PekReportSignature row (or a report status transition to SIGNED) is only ever created after that
 * call succeeds. Never persists "signed=true" on a failed/absent verification.
 */
@Service
public class PekReportSigningService {

    private final PekReportRepository reportRepository;
    private final PekReportDocumentVersionRepository versionRepository;
    private final PekReportSignatureRepository signatureRepository;
    private final PekReportReadinessService readinessService;
    private final PekReportWorkflowHistoryRepository historyRepository;
    private final SignatureVerificationService signatureVerificationService;
    private final FileStorageService fileStorageService;
    private final UserRepository userRepository;
    private final EdsSigningPolicyService edsSigningPolicyService;
    private final PekReportContentRevisionService contentRevisionService;

    public PekReportSigningService(PekReportRepository reportRepository,
                                    PekReportDocumentVersionRepository versionRepository,
                                    PekReportSignatureRepository signatureRepository,
                                    PekReportReadinessService readinessService,
                                    PekReportWorkflowHistoryRepository historyRepository,
                                    SignatureVerificationService signatureVerificationService,
                                    FileStorageService fileStorageService,
                                    UserRepository userRepository,
                                    EdsSigningPolicyService edsSigningPolicyService,
                                    PekReportContentRevisionService contentRevisionService) {
        this.reportRepository = reportRepository;
        this.versionRepository = versionRepository;
        this.signatureRepository = signatureRepository;
        this.readinessService = readinessService;
        this.historyRepository = historyRepository;
        this.signatureVerificationService = signatureVerificationService;
        this.fileStorageService = fileStorageService;
        this.userRepository = userRepository;
        this.edsSigningPolicyService = edsSigningPolicyService;
        this.contentRevisionService = contentRevisionService;
    }

    @Transactional
    public PekApiDtos.PekReportSignatureResponse sign(Long reportId, String cmsBase64, Long userId) {
        PekReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + reportId));
        if (report.getStatus() != PekReportStatus.APPROVED) {
            throw new ConflictException(
                    "Подписать можно только утверждённый отчёт (текущий статус: " + report.getStatus() + ")",
                    "PEK_REPORT_NOT_APPROVED");
        }
        if (!report.getStatus().canTransitionTo(PekReportStatus.SIGNED)) {
            throw new ConflictException("Переход в статус SIGNED недопустим из " + report.getStatus(),
                    "INVALID_REPORT_STATUS_TRANSITION");
        }
        PekApiDtos.ReadinessResponse readiness = readinessService.evaluate(report);
        if (!readiness.ready()) {
            throw new ConflictException("Отчёт не готов к подписанию: " + readiness.issues().get(0).message(),
                    "PEK_REPORT_NOT_READY");
        }
        // Only the latest OFFICIAL version may ever be signed. Using the newest row of ANY type
        // would let an INTERNAL analytical document (generated after the official one) become the
        // artifact that gets cryptographically signed and submitted to the state authority.
        PekReportDocumentVersion version = versionRepository
                .findTopByReportIdAndDocumentTypeOrderByVersionDesc(reportId, PekReportDocumentType.OFFICIAL)
                .orElseThrow(() -> {
                    if (versionRepository.existsByReportIdAndDocumentType(reportId, PekReportDocumentType.INTERNAL)) {
                        return new BadRequestException(
                                "Для отчёта сформирован только внутренний аналитический документ - "
                                        + "официальный отчёт не сформирован и не может быть подписан",
                                "PEK_REPORT_NO_OFFICIAL_DOCUMENT");
                    }
                    return new BadRequestException(
                            "Для отчёта не сформирован документ - сначала выполните генерацию PDF",
                            "PEK_REPORT_NO_DOCUMENT");
                });
        if (version.getPdfFileId() == null) {
            throw new BadRequestException("Для последней версии документа не сформирован PDF", "PEK_REPORT_NO_PDF");
        }
        // The report may have been edited (plan/fact rows, exceedances, permits, ...) after this
        // PDF was rendered but before signing - a stale sourceContentRevision means the PDF no
        // longer reflects the report's current data, so signing it would sign the wrong content.
        contentRevisionService.requireCurrent(version.getSourceContentRevision(), report);

        byte[] pdfBytes;
        try {
            pdfBytes = fileStorageService.load(version.getPdfFileId()).inputStream().readAllBytes();
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось прочитать PDF отчёта ПЭК для проверки подписи", e);
        }

        // Cryptographic verification against the exact PDF bytes - throws (never returns a
        // silent "verified=false") on any structural, signer, or content-mismatch problem. Only
        // code below this line may persist signed state.
        SignatureInfo info = signatureVerificationService.verifyDocument(cmsBase64, pdfBytes);

        // The signer must be the same person as the current user - a valid CMS signed by someone
        // else's certificate must never be accepted just because it verifies cryptographically.
        User actor = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Пользователь не найден: " + userId));
        edsSigningPolicyService.requireCertificateOwnedByCurrentUser(info, actor);

        StoredFileMetadata cmsMeta;
        try {
            cmsMeta = fileStorageService.storeBytes(cmsBase64.getBytes(StandardCharsets.UTF_8),
                    "pek-report-" + reportId + "-signature-" + userId + ".cms", "application/pkcs7-mime",
                    "pek-report-" + reportId, String.valueOf(userId));
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось сохранить файл подписи", e);
        }

        PekReportSignature signature = new PekReportSignature();
        signature.setReportId(reportId);
        signature.setDocumentVersionId(version.getId());
        signature.setSignerUserId(userId);
        signature.setSignedAt(LocalDateTime.now());
        signature.setDocumentHash(sha256Hex(pdfBytes));
        signature.setCmsFileId(cmsMeta.fileId());
        signature.setCertificateSubject(info.subjectDN());
        signature.setCertificateCn(info.commonName());
        signature.setCertificateSerial(info.serialNumber());
        signature.setCertificateOrganization(info.organization());
        signature.setVerified(info.verified());
        signatureRepository.saveAndFlush(signature);

        PekReportStatus before = report.getStatus();
        Long versionBefore = report.getVersion();
        report.setStatus(PekReportStatus.SIGNED);
        report.setUpdatedAt(LocalDateTime.now());
        reportRepository.saveAndFlush(report);

        PekReportWorkflowHistory h = new PekReportWorkflowHistory();
        h.setReportId(reportId);
        h.setFromStatus(before);
        h.setToStatus(report.getStatus());
        h.setAction("SIGN");
        h.setComment("Подписано: " + info.commonName() + " (" + info.serialNumber() + ")");
        h.setPerformedBy(userId);
        h.setVersionBefore(versionBefore);
        h.setVersionAfter(report.getVersion());
        historyRepository.save(h);

        return toResponse(signature);
    }

    @Transactional(readOnly = true)
    public java.util.List<PekApiDtos.PekReportSignatureResponse> listSignatures(Long reportId) {
        return signatureRepository.findByReportIdOrderBySignedAtDesc(reportId).stream().map(this::toResponse).toList();
    }

    private static String sha256Hex(byte[] data) {
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(data));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private PekApiDtos.PekReportSignatureResponse toResponse(PekReportSignature s) {
        return new PekApiDtos.PekReportSignatureResponse(s.getId(), s.getReportId(), s.getDocumentVersionId(),
                s.getSignerUserId(), s.getSignedAt().toString(), s.getDocumentHash(), s.getSignatureType(),
                s.getCertificateSubject(), s.getCertificateCn(), s.getCertificateSerial(),
                s.getCertificateOrganization(), s.isVerified());
    }
}
