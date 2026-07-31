package kz.eco.pek;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.storage.StoredFileContent;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

/**
 * PEK (производственный экологический контроль) module. Programs now support the full review
 * cycle (module spec §15) - create/edit/submit-review/return/approve/activate/archive/clone plus
 * documents and history - on top of the first vertical slice's report data-collection flow.
 * Optimistic locking is mandatory via the If-Match header (spec §2.2); every PEK_* permission is
 * checked per-endpoint (see PekSecurityExpressions), never a single blanket role check.
 */
@RestController
@RequestMapping("/api/pek")
public class PekController {

    private final PekProgramService programService;
    private final PekReportService reportService;
    private final PekDashboardService dashboardService;
    private final PekLookupService lookupService;

    public PekController(PekProgramService programService, PekReportService reportService,
                         PekDashboardService dashboardService, PekLookupService lookupService) {
        this.programService = programService;
        this.reportService = reportService;
        this.dashboardService = dashboardService;
        this.lookupService = lookupService;
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/dashboard")
    public ApiResponse<PekApiDtos.DashboardResponse> dashboard(
            @RequestParam(required = false) Long companyId, @RequestParam(required = false) Long objectId,
            @RequestParam(required = false) Integer year, @RequestParam(required = false) Integer quarter,
            @RequestParam(required = false) String status, @RequestParam(required = false) Long responsibleId) {
        return ApiResponse.ok(dashboardService.dashboard(companyId, objectId, year, quarter, status, responsibleId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/lookups/assignees")
    public ApiResponse<List<PekApiDtos.AssigneeResponse>> assignees(@RequestParam String roles) {
        return ApiResponse.ok(lookupService.assignees(roles));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/lookups/objects/{objectId}/permits")
    public ApiResponse<List<PekApiDtos.PermitResponse>> permits(@PathVariable Long objectId) {
        return ApiResponse.ok(lookupService.permitsForObject(objectId));
    }

    /** All filters optional (module spec §8): the first list open with no companyId/objectId must
     *  not 400 - see PekProgramRepository#search for how this is applied at the SQL level. */
    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/programs")
    public ApiResponse<kz.eco.common.PageResponse<PekApiDtos.ProgramResponse>> listPrograms(
            @RequestParam(required = false) Long companyId, @RequestParam(required = false) Long objectId,
            @RequestParam(required = false) String search, @RequestParam(required = false) String status,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate activeOn,
            @RequestParam(required = false) Long responsibleUserId,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort) {
        return ApiResponse.ok(programService.list(companyId, objectId, search, status, activeOn, responsibleUserId, page, size, sort));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/programs/{id}")
    public ApiResponse<PekApiDtos.ProgramResponse> getProgram(@PathVariable Long id) {
        return ApiResponse.ok(programService.get(id));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_CREATE)
    @PostMapping("/programs")
    public ApiResponse<PekApiDtos.ProgramResponse> createProgram(@RequestBody PekApiDtos.CreateProgramRequest request) {
        return ApiResponse.ok(programService.create(request, CurrentUser.get().getId()), "Программа ПЭК создана");
    }

    /** Full aggregate edit - only while the program is DRAFT/RETURNED (module spec §15/§16). */
    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PatchMapping("/programs/{id}")
    public ApiResponse<PekApiDtos.ProgramResponse> editProgram(
            @PathVariable Long id, @RequestBody PekApiDtos.EditProgramRequest request) {
        return ApiResponse.ok(programService.edit(id, request, CurrentUser.get().getId()), "Программа ПЭК изменена");
    }

    /** Same operation as editProgram, kept as a distinct path only because the frontend's autosave
     *  flow calls it on a timer with a header-only partial payload (controlItems/indicators/
     *  measures omitted -> left untouched, see EditProgramRequest javadoc) - not a second
     *  competing implementation, both delegate to the same PekProgramService#edit. */
    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PatchMapping("/programs/{id}/draft")
    public ApiResponse<PekApiDtos.ProgramResponse> autosaveProgramDraft(
            @PathVariable Long id, @RequestBody PekApiDtos.EditProgramRequest request) {
        return ApiResponse.ok(programService.edit(id, request, CurrentUser.get().getId()));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping(value = "/programs/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<PekApiDtos.ProgramDocumentResponse> uploadProgramDocument(
            @PathVariable Long id, @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) String documentType) throws IOException {
        return ApiResponse.ok(programService.uploadDocument(id, file, documentType, CurrentUser.get().getId()),
                "Документ загружен");
    }

    /** Always through this authorized endpoint - never a direct GridFS/filesystem URL (module spec
     *  §6.5, §18). */
    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/programs/{id}/documents/{documentId}")
    public ResponseEntity<InputStreamResource> downloadProgramDocument(
            @PathVariable Long id, @PathVariable Long documentId) throws IOException {
        return fileResponse(programService.downloadDocument(id, documentId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping("/programs/{id}/submit-review")
    public ApiResponse<PekApiDtos.ProgramResponse> submitProgramForReview(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(programService.submitReview(id, version, CurrentUser.get().getId()), "Программа отправлена на проверку");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_REVIEW)
    @PostMapping("/programs/{id}/return")
    public ApiResponse<PekApiDtos.ProgramResponse> returnProgram(
            @PathVariable Long id, @RequestHeader("If-Match") Long version,
            @RequestBody PekApiDtos.ReturnProgramRequest request) {
        return ApiResponse.ok(programService.returnProgram(id, version, request.reason(), CurrentUser.get().getId()),
                "Программа возвращена на доработку");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_APPROVE)
    @PostMapping("/programs/{id}/approve")
    public ApiResponse<PekApiDtos.ProgramResponse> approveProgram(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(programService.approve(id, version, CurrentUser.get().getId()), "Программа утверждена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_ACTIVATE)
    @PostMapping("/programs/{id}/activate")
    public ApiResponse<PekApiDtos.ProgramResponse> activateProgram(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(programService.activate(id, version, CurrentUser.get().getId()), "Программа ПЭК активирована");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_ARCHIVE)
    @PostMapping("/programs/{id}/archive")
    public ApiResponse<PekApiDtos.ProgramResponse> archiveProgram(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(programService.archive(id, version, CurrentUser.get().getId()), "Программа ПЭК архивирована");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_CREATE)
    @PostMapping("/programs/{id}/clone")
    public ApiResponse<PekApiDtos.ProgramResponse> cloneProgram(
            @PathVariable Long id, @RequestBody PekApiDtos.CloneProgramRequest request) {
        return ApiResponse.ok(programService.clone(id, request, CurrentUser.get().getId()), "Программа скопирована");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/programs/{id}/history")
    public ApiResponse<List<PekApiDtos.ProgramHistoryEntry>> programHistory(@PathVariable Long id) {
        return ApiResponse.ok(programService.history(id));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports")
    public ApiResponse<kz.eco.common.PageResponse<PekApiDtos.ReportResponse>> listReports(
            @RequestParam Long companyId, @RequestParam Long objectId,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return ApiResponse.ok(reportService.listForObjectPaged(companyId, objectId, page, size));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports/{id}")
    public ApiResponse<PekApiDtos.ReportResponse> getReport(@PathVariable Long id) {
        return ApiResponse.ok(reportService.get(id));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports/creation-context")
    public ApiResponse<PekApiDtos.ReportCreationContext> creationContext(
            @RequestParam Long companyId, @RequestParam Long objectId,
            @RequestParam String periodType, @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer quarter) {
        return ApiResponse.ok(reportService.creationContext(companyId, objectId, periodType, year, quarter));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_CREATE)
    @PostMapping("/reports")
    public ApiResponse<PekApiDtos.ReportResponse> createReport(@RequestBody PekApiDtos.CreateReportRequest request) {
        return ApiResponse.ok(reportService.create(request, CurrentUser.get().getId()), "Отчёт ПЭК создан");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_COLLECT)
    @PostMapping("/reports/{id}/collect")
    public ApiResponse<PekApiDtos.CollectionResult> collect(@PathVariable Long id) {
        return ApiResponse.ok(reportService.collect(id), "Сбор данных выполнен");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_SUBMIT)
    @PostMapping("/reports/{id}/submit-review")
    public ApiResponse<PekApiDtos.ReportResponse> submitForReview(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(reportService.submitForReview(id, version), "Отчёт отправлен на проверку");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_APPROVE)
    @PostMapping("/reports/{id}/approve")
    public ApiResponse<PekApiDtos.ReportResponse> approve(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(reportService.approve(id, version), "Отчёт утверждён");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_APPROVE)
    @PostMapping("/reports/{id}/archive")
    public ApiResponse<PekApiDtos.ReportResponse> archive(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(reportService.archive(id, version), "Отчёт архивирован");
    }

    private ResponseEntity<InputStreamResource> fileResponse(StoredFileContent file) {
        String encoded = URLEncoder.encode(file.filename(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .body(new InputStreamResource(file.inputStream()));
    }
}
