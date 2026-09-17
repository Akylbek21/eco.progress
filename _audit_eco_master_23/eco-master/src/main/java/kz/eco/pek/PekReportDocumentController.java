package kz.eco.pek;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.common.exception.NotFoundException;
import kz.eco.pek.docgen.PekReportDocumentGenerationService;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.storage.StoredFileContent;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * PEK final-report document generation and signing (Iteration 3 of the PEK module overhaul). Own
 * controller, same precedent as {@link PekPermitController}/{@link PekSettingsController} - a
 * distinct sub-resource controller rather than folding into the already-large {@link PekController}.
 * Every endpoint resolves the report first and calls {@link PekAccessService#requireReportAccess}
 * before doing anything else, exactly like Iteration 1/2 endpoints - downloads are never served
 * from a raw/public file URL, only through this authorized API path.
 */
@RestController
@RequestMapping("/api/pek/reports/{reportId}/document")
public class PekReportDocumentController {

    private final PekReportDocumentGenerationService generationService;
    private final PekReportSigningService signingService;
    private final PekReportRepository reportRepository;
    private final PekAccessService accessService;
    private final kz.eco.storage.FileStorageService fileStorageService;
    private final PekReportSignatureRepository signatureRepository;
    private final PekReportContentRevisionService contentRevisionService;
    private final kz.eco.user.UserRepository userRepository;

    public PekReportDocumentController(PekReportDocumentGenerationService generationService,
                                        PekReportSigningService signingService,
                                        PekReportRepository reportRepository,
                                        PekAccessService accessService,
                                        kz.eco.storage.FileStorageService fileStorageService,
                                        PekReportSignatureRepository signatureRepository,
                                        PekReportContentRevisionService contentRevisionService,
                                        kz.eco.user.UserRepository userRepository) {
        this.generationService = generationService;
        this.signingService = signingService;
        this.reportRepository = reportRepository;
        this.accessService = accessService;
        this.fileStorageService = fileStorageService;
        this.signatureRepository = signatureRepository;
        this.contentRevisionService = contentRevisionService;
        this.userRepository = userRepository;
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/generate-docx")
    public ApiResponse<PekApiDtos.PekReportDocumentVersionResponse> generateDocx(@PathVariable Long reportId) {
        PekReport report = requireReportAccess(reportId);
        return ApiResponse.ok(toDto(generationService.generateDocx(reportId, CurrentUser.get().getId()), report),
                "DOCX отчёта сформирован");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/generate-pdf")
    public ApiResponse<PekApiDtos.PekReportDocumentVersionResponse> generatePdf(@PathVariable Long reportId) {
        PekReport report = requireReportAccess(reportId);
        return ApiResponse.ok(toDto(generationService.generatePdf(reportId, CurrentUser.get().getId()), report),
                "PDF отчёта сформирован");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/versions")
    public ApiResponse<List<PekApiDtos.PekReportDocumentVersionResponse>> versions(
            @PathVariable Long reportId,
            @RequestParam(required = false) PekReportDocumentType documentType) {
        PekReport report = requireReportAccess(reportId);
        return ApiResponse.ok(generationService.listVersions(reportId, resolveType(documentType))
                .stream().map(v -> toDto(v, report)).toList());
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/versions/latest")
    public ApiResponse<PekApiDtos.PekReportDocumentVersionResponse> latestVersion(
            @PathVariable Long reportId,
            @RequestParam(required = false) PekReportDocumentType documentType) {
        PekReport report = requireReportAccess(reportId);
        return ApiResponse.ok(toDto(generationService.latestVersion(reportId, resolveType(documentType)), report));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/download/docx")
    public ResponseEntity<InputStreamResource> downloadDocx(
            @PathVariable Long reportId,
            @RequestParam(required = false) PekReportDocumentType documentType) throws IOException {
        PekReport report = requireReportAccess(reportId);
        var version = generationService.latestVersion(reportId, resolveType(documentType));
        if (version.getDocxFileId() == null) {
            throw new NotFoundException("DOCX для отчёта ещё не сформирован", "DOCUMENT_FILE_NOT_FOUND");
        }
        contentRevisionService.requireCurrent(version.getSourceContentRevision(), report);
        return download(version.getDocxFileId());
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/download/pdf")
    public ResponseEntity<InputStreamResource> downloadPdf(
            @PathVariable Long reportId,
            @RequestParam(required = false) PekReportDocumentType documentType) throws IOException {
        PekReport report = requireReportAccess(reportId);
        var version = generationService.latestVersion(reportId, resolveType(documentType));
        if (version.getPdfFileId() == null) {
            throw new NotFoundException("PDF для отчёта ещё не сформирован", "DOCUMENT_FILE_NOT_FOUND");
        }
        contentRevisionService.requireCurrent(version.getSourceContentRevision(), report);
        return download(version.getPdfFileId());
    }

    /** Module fix P2 item 1: historical download - unlike /download/docx above (which always
     *  serves the LATEST version and enforces staleness), this serves the exact requested
     *  versionId's file, never substituted with the latest, and never blocked by staleness
     *  (a historical version is by definition a fixed snapshot - "stale" only describes whether it
     *  still matches the report's current content, which is surfaced in the DTO, not enforced
     *  here). {@link PekReportDocumentGenerationService#getVersion} enforces that versionId
     *  actually belongs to reportId, preventing IDOR via a versionId from another report. */
    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/versions/{versionId}/download/docx")
    public ResponseEntity<InputStreamResource> downloadVersionDocx(@PathVariable Long reportId,
                                                                     @PathVariable Long versionId,
                                                                     @RequestParam(required = false) PekReportDocumentType documentType) throws IOException {
        requireReportAccess(reportId);
        PekReportDocumentVersion version = generationService.getVersion(reportId, versionId, documentType);
        if (version.getDocxFileId() == null) {
            throw new NotFoundException("DOCX для этой версии документа не найден", "DOCUMENT_FILE_NOT_FOUND");
        }
        return download(version.getDocxFileId());
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/versions/{versionId}/download/pdf")
    public ResponseEntity<InputStreamResource> downloadVersionPdf(@PathVariable Long reportId,
                                                                    @PathVariable Long versionId,
                                                                    @RequestParam(required = false) PekReportDocumentType documentType) throws IOException {
        requireReportAccess(reportId);
        PekReportDocumentVersion version = generationService.getVersion(reportId, versionId, documentType);
        if (version.getPdfFileId() == null) {
            throw new NotFoundException("PDF для этой версии документа не найден", "DOCUMENT_FILE_NOT_FOUND");
        }
        return download(version.getPdfFileId());
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_SIGN)
    @PostMapping("/sign")
    public ApiResponse<PekApiDtos.PekReportSignatureResponse> sign(@PathVariable Long reportId,
                                                                     @RequestBody PekApiDtos.SignPekReportRequest request) {
        requireReportAccess(reportId);
        return ApiResponse.ok(signingService.sign(reportId, request.cms(), CurrentUser.get().getId()),
                "Отчёт ПЭК подписан");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/signatures")
    public ApiResponse<List<PekApiDtos.PekReportSignatureResponse>> signatures(@PathVariable Long reportId) {
        requireReportAccess(reportId);
        return ApiResponse.ok(signingService.listSignatures(reportId));
    }

    /** IDOR fix: the requested signatureFileId must be looked up and its OWN reportId compared
     *  against the path's reportId - previously this only checked "does this report have any
     *  signature at all" (always true after the report-level access check below has already
     *  passed once), which let any PEK_VIEW user with legitimate access to report A download the
     *  CMS signature file of report B (any company) just by guessing/enumerating signatureFileId. */
    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/download/signature/{signatureFileId}")
    public ResponseEntity<InputStreamResource> downloadSignature(@PathVariable Long reportId,
                                                                   @PathVariable String signatureFileId) throws IOException {
        requireReportAccess(reportId);
        PekReportSignature signature = signatureRepository.findByCmsFileId(signatureFileId)
                .orElseThrow(() -> new NotFoundException("Подпись не найдена"));
        if (!signature.getReportId().equals(reportId)) {
            throw new NotFoundException("Подпись не найдена");
        }
        return download(signatureFileId);
    }

    /** Module fix: the frontend previously had to know the internal storage fileId
     *  (signatureFileId) to build a signature-download URL - {@link PekApiDtos.PekReportSignatureResponse}
     *  never even exposed it, so there was no supported way to discover it. This resolves by the
     *  signature's own numeric id instead, with the backend looking up the CMS file id internally.
     *  Ownership is checked in full: the signature must exist, belong to this reportId, the caller
     *  must have access to the report (requireReportAccess below), and the resolved file must be
     *  the one recorded on that exact signature row (never a caller-supplied fileId). */
    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/signatures/{signatureId}/download")
    public ResponseEntity<InputStreamResource> downloadSignatureById(@PathVariable Long reportId,
                                                                       @PathVariable Long signatureId) throws IOException {
        requireReportAccess(reportId);
        PekReportSignature signature = signatureRepository.findById(signatureId)
                .orElseThrow(() -> new NotFoundException("Подпись не найдена"));
        if (!signature.getReportId().equals(reportId)) {
            throw new NotFoundException("Подпись не найдена");
        }
        if (signature.getCmsFileId() == null) {
            throw new NotFoundException("CMS-файл подписи не найден");
        }
        return download(signature.getCmsFileId());
    }

    /** Backward compatibility: an absent documentType means the OFFICIAL (state-facing) document,
     *  NOT "the newest document of any type" - an INTERNAL analytical document generated after the
     *  official one must never be served, signed, or submitted in the official document's place. */
    private static PekReportDocumentType resolveType(PekReportDocumentType requested) {
        return requested == null ? PekReportDocumentType.OFFICIAL : requested;
    }

    private ResponseEntity<InputStreamResource> download(String fileId) throws IOException {
        StoredFileContent content = fileStorageService.load(fileId);
        String encodedName = URLEncoder.encode(content.filename(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedName)
                .body(new InputStreamResource(content.inputStream()));
    }

    private PekReport requireReportAccess(Long reportId) {
        PekReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new NotFoundException("Отчёт ПЭК не найден: " + reportId));
        var user = CurrentUser.get();
        accessService.requireReportAccess(user.getId(), user.getRole(), report);
        return report;
    }

    private PekApiDtos.PekReportDocumentVersionResponse toDto(PekReportDocumentVersion v, PekReport report) {
        Long current = report.getContentRevision();
        boolean stale = v.getSourceContentRevision() != null && !v.getSourceContentRevision().equals(current);
        String generatedByName = v.getGeneratedBy() == null ? null
                : userRepository.findById(v.getGeneratedBy()).map(kz.eco.user.User::getName).orElse(null);
        return new PekApiDtos.PekReportDocumentVersionResponse(v.getId(), v.getReportId(), v.getVersion(),
                v.getDocumentType() == null ? null : v.getDocumentType().name(),
                v.getDocxFileId() != null, v.getPdfFileId() != null, v.getContentHash(),
                v.getGeneratedAt() == null ? null : v.getGeneratedAt().toString(), v.getGeneratedBy(), generatedByName,
                v.getSourceContentRevision(), current, stale);
    }
}
