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
    private final kz.eco.pek.docgen.PekExplanatoryNoteGenerationService explanatoryNoteService;
    private final kz.eco.pek.docgen.PekEnvironmentalMeasuresDocumentGenerationService measuresService;
    private final PekMonitoringExcelGenerationService emissionsService;
    private final PekProgramRepository programRepository;

    public PekReportDocumentController(PekReportDocumentGenerationService generationService,
                                        PekReportSigningService signingService,
                                        PekReportRepository reportRepository,
                                        PekAccessService accessService,
                                        kz.eco.storage.FileStorageService fileStorageService,
                                        PekReportSignatureRepository signatureRepository,
                                        PekReportContentRevisionService contentRevisionService,
                                        kz.eco.user.UserRepository userRepository,
                                        kz.eco.pek.docgen.PekExplanatoryNoteGenerationService explanatoryNoteService,
                                        kz.eco.pek.docgen.PekEnvironmentalMeasuresDocumentGenerationService measuresService,
                                        PekMonitoringExcelGenerationService emissionsService,
                                        PekProgramRepository programRepository) {
        this.generationService = generationService;
        this.signingService = signingService;
        this.reportRepository = reportRepository;
        this.accessService = accessService;
        this.fileStorageService = fileStorageService;
        this.signatureRepository = signatureRepository;
        this.contentRevisionService = contentRevisionService;
        this.userRepository = userRepository;
        this.explanatoryNoteService = explanatoryNoteService;
        this.measuresService = measuresService;
        this.emissionsService = emissionsService;
        this.programRepository = programRepository;
    }

    /** documentType absent = the official report (unchanged behaviour). For EXPLANATORY_NOTE and
     *  ENVIRONMENTAL_MEASURES the DOCX and its PDF are always produced together as one version, so
     *  generate-docx and generate-pdf do the same thing for them. */
    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/generate-docx")
    public ApiResponse<PekApiDtos.PekReportDocumentVersionResponse> generateDocx(
            @PathVariable Long reportId, @RequestParam(required = false) PekReportDocumentType documentType) {
        requireReportAccess(reportId);
        Long userId = CurrentUser.get().getId();
        PekReportDocumentVersion v = switch (resolveType(documentType)) {
            case OFFICIAL -> generationService.generateDocx(reportId, userId);
            case INTERNAL -> generationService.generateInternalDocx(reportId, userId);
            case EXPLANATORY_NOTE, ENVIRONMENTAL_MEASURES -> generateWordAndPdf(reportId, documentType, userId);
            case EMISSIONS_XLSX -> throw xlsxOnly();
        };
        return ApiResponse.ok(toDto(v, reportRepository.findById(reportId).orElseThrow()), "DOCX сформирован");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/generate-pdf")
    public ApiResponse<PekApiDtos.PekReportDocumentVersionResponse> generatePdf(
            @PathVariable Long reportId, @RequestParam(required = false) PekReportDocumentType documentType) {
        requireReportAccess(reportId);
        Long userId = CurrentUser.get().getId();
        PekReportDocumentVersion v = switch (resolveType(documentType)) {
            case OFFICIAL -> generationService.generatePdf(reportId, userId);
            case INTERNAL -> generationService.generateInternalPdf(reportId, userId);
            case EXPLANATORY_NOTE, ENVIRONMENTAL_MEASURES -> generateWordAndPdf(reportId, documentType, userId);
            case EMISSIONS_XLSX -> throw xlsxOnly();
        };
        return ApiResponse.ok(toDto(v, reportRepository.findById(reportId).orElseThrow()), "PDF сформирован");
    }

    /** Официальная таблица выбросов (EMISSIONS_XLSX). 409 PEK_DOCUMENT_NOT_READY lists what is missing. */
    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/generate-xlsx")
    public ApiResponse<PekApiDtos.PekReportDocumentVersionResponse> generateXlsx(@PathVariable Long reportId) {
        requireReportAccess(reportId);
        PekReportDocumentVersion v = emissionsService.generate(reportId, CurrentUser.get().getId());
        return ApiResponse.ok(toDto(v, reportRepository.findById(reportId).orElseThrow()), "XLSX выбросов сформирован");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/download/xlsx")
    public ResponseEntity<InputStreamResource> downloadXlsx(@PathVariable Long reportId) throws IOException {
        PekReport report = requireReportAccess(reportId);
        var version = generationService.latestVersion(reportId, PekReportDocumentType.EMISSIONS_XLSX);
        if (version.getXlsxFileId() == null) {
            throw new NotFoundException("XLSX для отчёта ещё не сформирован", "DOCUMENT_FILE_NOT_FOUND");
        }
        requireCurrent(version, report);
        return download(version.getXlsxFileId());
    }

    private PekReportDocumentVersion generateWordAndPdf(Long reportId, PekReportDocumentType type, Long userId) {
        return type == PekReportDocumentType.EXPLANATORY_NOTE
                ? explanatoryNoteService.generate(reportId, userId)
                : measuresService.generate(reportId, userId);
    }

    private static kz.eco.common.exception.BadRequestException xlsxOnly() {
        return new kz.eco.common.exception.BadRequestException(
                "Таблица выбросов формируется только в XLSX - используйте generate-xlsx", "PEK_DOCUMENT_FORMAT_UNSUPPORTED");
    }

    /** Report-content staleness for every type, plus program-content staleness for the document
     *  types that print program data. */
    private void requireCurrent(PekReportDocumentVersion version, PekReport report) {
        contentRevisionService.requireCurrent(version.getSourceContentRevision(), report);
        if (isStale(version, report)) {
            throw new kz.eco.common.exception.ConflictException(
                    "Документ устарел - программа ПЭК изменилась после его формирования, сформируйте документ заново",
                    "PEK_DOCUMENT_STALE");
        }
    }

    private boolean isStale(PekReportDocumentVersion v, PekReport report) {
        PekProgram program = v.getSourceProgramContentRevision() == null ? null
                : programRepository.findById(report.getProgramId()).orElse(null);
        return kz.eco.pek.docgen.PekReportDocumentStore.isStale(v, report, program);
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
        requireCurrent(version, report);
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
        requireCurrent(version, report);
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

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/versions/{versionId}/download/xlsx")
    public ResponseEntity<InputStreamResource> downloadVersionXlsx(@PathVariable Long reportId,
                                                                     @PathVariable Long versionId) throws IOException {
        requireReportAccess(reportId);
        PekReportDocumentVersion version = generationService.getVersion(reportId, versionId,
                PekReportDocumentType.EMISSIONS_XLSX);
        if (version.getXlsxFileId() == null) {
            throw new NotFoundException("XLSX для этой версии документа не найден", "DOCUMENT_FILE_NOT_FOUND");
        }
        return download(version.getXlsxFileId());
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
        boolean stale = isStale(v, report);
        String generatedByName = v.getGeneratedBy() == null ? null
                : userRepository.findById(v.getGeneratedBy()).map(kz.eco.user.User::getName).orElse(null);
        return new PekApiDtos.PekReportDocumentVersionResponse(v.getId(), v.getReportId(), v.getVersion(),
                v.getDocumentType() == null ? null : v.getDocumentType().name(),
                v.getDocxFileId() != null, v.getPdfFileId() != null, v.getContentHash(),
                v.getGeneratedAt() == null ? null : v.getGeneratedAt().toString(), v.getGeneratedBy(), generatedByName,
                v.getSourceContentRevision(), current, stale, v.getXlsxFileId() != null);
    }
}
