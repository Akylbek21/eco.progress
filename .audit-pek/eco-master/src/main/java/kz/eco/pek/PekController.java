package kz.eco.pek;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.storage.StoredFileContent;
import kz.eco.user.User;
import kz.eco.user.UserRole;
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
import java.util.Set;

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
    private final PekProtocolLinkService protocolLinkService;
    private final PekAccessService accessService;
    private final PekProgramControlItemRepository controlItemRepository;
    private final PekExceedanceService exceedanceService;
    private final PekCollectionScheduler collectionScheduler;
    private final PekProgramMonitoringService monitoringService;
    private final PekReportSubmissionService submissionService;
    private final kz.eco.pek.docgen.PekReportDocumentGenerationService documentGenerationService;

    public PekController(PekProgramService programService, PekReportService reportService,
                         PekDashboardService dashboardService, PekLookupService lookupService,
                         PekProtocolLinkService protocolLinkService, PekAccessService accessService,
                         PekProgramControlItemRepository controlItemRepository,
                         PekExceedanceService exceedanceService, PekCollectionScheduler collectionScheduler,
                         PekProgramMonitoringService monitoringService,
                         PekReportSubmissionService submissionService,
                         kz.eco.pek.docgen.PekReportDocumentGenerationService documentGenerationService) {
        this.programService = programService;
        this.reportService = reportService;
        this.dashboardService = dashboardService;
        this.lookupService = lookupService;
        this.protocolLinkService = protocolLinkService;
        this.accessService = accessService;
        this.controlItemRepository = controlItemRepository;
        this.exceedanceService = exceedanceService;
        this.collectionScheduler = collectionScheduler;
        this.monitoringService = monitoringService;
        this.submissionService = submissionService;
        this.documentGenerationService = documentGenerationService;
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/programs/{id}/monitoring")
    public ApiResponse<kz.eco.pek.dto.PekMonitoringDtos.ListResponse> monitoring(@PathVariable Long id) {
        requireProgramAccess(id);
        return ApiResponse.ok(monitoringService.listResponse(id));
    }

    /** If-Match is the program's JPA @Version - monitoring is part of the program aggregate and
     *  every monitoring mutation increments program.version + contentRevision, making any
     *  previously generated document stale. */
    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping("/programs/{id}/monitoring")
    public ApiResponse<PekApiDtos.ProgramResponse> createMonitoring(
            @PathVariable Long id, @RequestBody kz.eco.pek.dto.PekMonitoringDtos.Request request,
            @RequestHeader("If-Match") Long programVersion) {
        requireProgramAccess(id);
        return ApiResponse.ok(monitoringService.create(id, request, programVersion), "Направление мониторинга добавлено");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PutMapping("/programs/{id}/monitoring/{monitoringId}")
    public ApiResponse<PekApiDtos.ProgramResponse> updateMonitoring(
            @PathVariable Long id, @PathVariable Long monitoringId,
            @RequestBody kz.eco.pek.dto.PekMonitoringDtos.Request request,
            @RequestHeader("If-Match") Long programVersion) {
        requireProgramAccess(id);
        return ApiResponse.ok(monitoringService.update(id, monitoringId, request, programVersion), "Направление мониторинга изменено");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @DeleteMapping("/programs/{id}/monitoring/{monitoringId}")
    public ApiResponse<PekApiDtos.ProgramResponse> deleteMonitoring(@PathVariable Long id, @PathVariable Long monitoringId,
                                               @RequestHeader("If-Match") Long programVersion) {
        requireProgramAccess(id);
        PekApiDtos.ProgramResponse response = monitoringService.delete(id, monitoringId, programVersion);
        return ApiResponse.ok(response, "Направление мониторинга исключено");
    }

    // --- Submission lifecycle: SIGNED → SUBMITTED → ACCEPTED | REJECTED ---------------------

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/reports/{reportId}/submit")
    public ApiResponse<Void> submitReport(@PathVariable Long reportId,
                                           @RequestHeader("If-Match") Long version) {
        requireReportAccess(reportId);
        submissionService.submit(reportId, version);
        return ApiResponse.ok(null, "Отчёт передан на рассмотрение");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/reports/{reportId}/accept")
    public ApiResponse<Void> acceptReport(@PathVariable Long reportId,
                                           @RequestHeader("If-Match") Long version) {
        requireReportAccess(reportId);
        submissionService.accept(reportId, version);
        return ApiResponse.ok(null, "Отчёт принят");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/reports/{reportId}/reject")
    public ApiResponse<Void> rejectReport(@PathVariable Long reportId,
                                           @RequestHeader("If-Match") Long version,
                                           @RequestBody PekApiDtos.RejectReportRequest request) {
        requireReportAccess(reportId);
        submissionService.reject(reportId, version, request.rejectionReason());
        return ApiResponse.ok(null, "Отчёт отклонён");
    }

    // --- Document generation: official (normative template) and internal (analytical) ---------

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/reports/{reportId}/document/generate-official-docx")
    public ApiResponse<PekApiDtos.PekReportDocumentVersionResponse> generateOfficialDocx(@PathVariable Long reportId) {
        requireReportAccess(reportId);
        PekReport report = reportService.getReportById(reportId);
        return ApiResponse.ok(toDocVersionDto(documentGenerationService.generateOfficialDocx(reportId, CurrentUser.get().getId()), report),
                "Официальный DOCX отчёта сформирован");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/reports/{reportId}/document/generate-official-pdf")
    public ApiResponse<PekApiDtos.PekReportDocumentVersionResponse> generateOfficialPdf(@PathVariable Long reportId) {
        requireReportAccess(reportId);
        PekReport report = reportService.getReportById(reportId);
        return ApiResponse.ok(toDocVersionDto(documentGenerationService.generateOfficialPdf(reportId, CurrentUser.get().getId()), report),
                "Официальный PDF отчёта сформирован");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/reports/{reportId}/document/generate-internal-docx")
    public ApiResponse<PekApiDtos.PekReportDocumentVersionResponse> generateInternalDocx(@PathVariable Long reportId) {
        requireReportAccess(reportId);
        PekReport report = reportService.getReportById(reportId);
        return ApiResponse.ok(toDocVersionDto(documentGenerationService.generateInternalDocx(reportId, CurrentUser.get().getId()), report),
                "Внутренний аналитический DOCX сформирован");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/reports/{reportId}/document/generate-internal-pdf")
    public ApiResponse<PekApiDtos.PekReportDocumentVersionResponse> generateInternalPdf(@PathVariable Long reportId) {
        requireReportAccess(reportId);
        PekReport report = reportService.getReportById(reportId);
        return ApiResponse.ok(toDocVersionDto(documentGenerationService.generateInternalPdf(reportId, CurrentUser.get().getId()), report),
                "Внутренний аналитический PDF сформирован");
    }

    private PekApiDtos.PekReportDocumentVersionResponse toDocVersionDto(
            kz.eco.pek.PekReportDocumentVersion v, PekReport report) {
        Long current = report.getContentRevision();
        boolean stale = v.getSourceContentRevision() != null && !v.getSourceContentRevision().equals(current);
        return new PekApiDtos.PekReportDocumentVersionResponse(v.getId(), v.getReportId(), v.getVersion(),
                v.getDocumentType() == null ? null : v.getDocumentType().name(),
                v.getDocxFileId() != null, v.getPdfFileId() != null, v.getContentHash(),
                v.getGeneratedAt() == null ? null : v.getGeneratedAt().toString(), v.getGeneratedBy(), null,
                v.getSourceContentRevision(), current, stale);
    }

    // --- Scheduler admin (Iteration 4) --------------------------------------------------------

    /** Module fix item 5: synchronous manual re-run scoped to exactly one company - companyId is
     *  now required and honored, never silently ignored in favor of sweeping every company. Use
     *  POST /scheduler/run-all below for the deliberate global sweep. */
    @PreAuthorize(PekSecurityExpressions.PEK_ADMIN)
    @PostMapping("/scheduler/run")
    public ApiResponse<PekApiDtos.SchedulerRunLogResponse> runSchedulerManually(@RequestParam Long companyId) {
        requireCompanyAccess(companyId);
        User user = CurrentUser.get();
        PekSchedulerRunLog runLog = collectionScheduler.manualRun(user.getId(), companyId);
        if (runLog == null) {
            throw new kz.eco.common.exception.ConflictException(
                    "Плановый запуск уже выполняется", "PEK_SCHEDULER_RUN_IN_PROGRESS");
        }
        return ApiResponse.ok(toSchedulerRunLogResponse(runLog));
    }

    /** Module fix item 5: the deliberate global sweep across every company - a distinct operation
     *  from the company-scoped run above, not a fallback for it. */
    @PreAuthorize(PekSecurityExpressions.PEK_ADMIN)
    @PostMapping("/scheduler/run-all")
    public ApiResponse<PekApiDtos.SchedulerRunLogResponse> runSchedulerForAllCompanies() {
        User user = CurrentUser.get();
        PekSchedulerRunLog runLog = collectionScheduler.manualRunAll(user.getId());
        if (runLog == null) {
            throw new kz.eco.common.exception.ConflictException(
                    "Плановый запуск уже выполняется", "PEK_SCHEDULER_RUN_IN_PROGRESS");
        }
        return ApiResponse.ok(toSchedulerRunLogResponse(runLog));
    }

    private static PekApiDtos.SchedulerRunLogResponse toSchedulerRunLogResponse(PekSchedulerRunLog r) {
        return new PekApiDtos.SchedulerRunLogResponse(r.getId(), r.getJobName(),
                r.getStatus() == null ? null : r.getStatus().name(),
                r.getStartedAt() == null ? null : r.getStartedAt().toString(),
                r.getFinishedAt() == null ? null : r.getFinishedAt().toString(),
                r.getProcessedCount(), r.getErrorCount(), r.getErrorSummary(), r.getTriggeredBy());
    }

    // --- Exceedance / corrective-action workflow (Iteration 2) -------------------------------

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports/{reportId}/exceedances")
    public ApiResponse<List<PekApiDtos.ExceedanceResponse>> exceedancesByReport(@PathVariable Long reportId) {
        requireReportAccess(reportId);
        return ApiResponse.ok(exceedanceService.listByReport(reportId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/exceedances/{id}")
    public ApiResponse<PekApiDtos.ExceedanceResponse> getExceedance(@PathVariable Long id) {
        return ApiResponse.ok(exceedanceService.get(id));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/exceedances/{id}/assign")
    public ApiResponse<PekApiDtos.ExceedanceResponse> assignExceedanceResponsible(
            @PathVariable Long id, @RequestBody PekApiDtos.AssignExceedanceResponsibleRequest request,
            @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(exceedanceService.assignResponsible(id, request, version, CurrentUser.get().getId()),
                "Ответственный назначен");
    }

    /** Uploads the evidence file itself, tagging it as belonging to this exceedance - the
     *  returned fileId is only ever valid to attach via attachExceedanceEvidence below (module fix
     *  item 6: attaching an arbitrary client-supplied fileId with no such provenance is no longer
     *  accepted). */
    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping(value = "/exceedances/{id}/evidence-files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<PekApiDtos.EvidenceFileUploadResponse> uploadExceedanceEvidenceFile(
            @PathVariable Long id, @RequestPart("file") MultipartFile file,
            @RequestHeader("If-Match") Long version) throws IOException {
        return ApiResponse.ok(exceedanceService.uploadEvidenceFile(id, file, version, CurrentUser.get().getId()),
                "Файл загружен");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/exceedances/{id}/evidence")
    public ApiResponse<PekApiDtos.ExceedanceResponse> attachExceedanceEvidence(
            @PathVariable Long id, @RequestBody PekApiDtos.AttachExceedanceEvidenceRequest request,
            @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(exceedanceService.attachEvidence(id, request, version, CurrentUser.get().getId()),
                "Файл-подтверждение прикреплён");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/exceedances/{id}/transition")
    public ApiResponse<PekApiDtos.ExceedanceResponse> transitionExceedance(
            @PathVariable Long id, @RequestBody PekApiDtos.TransitionExceedanceRequest request,
            @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(exceedanceService.transition(id, request, version, CurrentUser.get().getId()),
                "Статус превышения изменён");
    }

    // --- Corrective actions: a tracked sub-resource of the exceedance aggregate ---------------
    // If-Match on every endpoint below is the parent EXCEEDANCE's version (same convention as
    // monitoring's If-Match being the parent program's version) - see PekExceedanceService's class
    // javadoc on the corrective-action methods.

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/exceedances/{id}/corrective-actions")
    public ApiResponse<List<PekApiDtos.CorrectiveActionResponse>> listCorrectiveActions(@PathVariable Long id) {
        return ApiResponse.ok(exceedanceService.listCorrectiveActions(id));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/exceedances/{id}/corrective-actions")
    public ApiResponse<PekApiDtos.CorrectiveActionResponse> createCorrectiveAction(
            @PathVariable Long id, @RequestBody PekApiDtos.CorrectiveActionRequest request,
            @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(exceedanceService.createCorrectiveAction(id, request, version, CurrentUser.get().getId()),
                "Корректирующее мероприятие добавлено");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PutMapping("/exceedances/{id}/corrective-actions/{actionId}")
    public ApiResponse<PekApiDtos.CorrectiveActionResponse> updateCorrectiveAction(
            @PathVariable Long id, @PathVariable Long actionId, @RequestBody PekApiDtos.CorrectiveActionRequest request,
            @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(exceedanceService.updateCorrectiveAction(id, actionId, request, version, CurrentUser.get().getId()),
                "Корректирующее мероприятие изменено");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @DeleteMapping("/exceedances/{id}/corrective-actions/{actionId}")
    public ApiResponse<Void> deleteCorrectiveAction(
            @PathVariable Long id, @PathVariable Long actionId, @RequestHeader("If-Match") Long version) {
        exceedanceService.deleteCorrectiveAction(id, actionId, version, CurrentUser.get().getId());
        return ApiResponse.ok(null, "Корректирующее мероприятие удалено");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/exceedances/{id}/corrective-actions/{actionId}/transition")
    public ApiResponse<PekApiDtos.CorrectiveActionResponse> transitionCorrectiveAction(
            @PathVariable Long id, @PathVariable Long actionId, @RequestBody PekApiDtos.CorrectiveActionTransitionRequest request,
            @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(exceedanceService.transitionCorrectiveAction(id, actionId, request, version, CurrentUser.get().getId()),
                "Статус корректирующего мероприятия изменён");
    }

    /** Tenant-scoping helpers (Iteration 1 of the PEK module overhaul). Every endpoint below that
     *  reads/mutates a specific program/report/object by id calls one of these BEFORE delegating to
     *  the service layer; list endpoints instead resolve {@link #accessibleCompanyIds()} and pass
     *  it down so filtering happens at the query level (see PekProgramService#list,
     *  PekDashboardService#dashboard, PekLookupService#assignees). Role checks via
     *  {@link PekSecurityExpressions} stay exactly as they were - this is an additional, orthogonal
     *  company-scope gate, not a replacement. */
    private void requireProgramAccess(Long programId) {
        User user = CurrentUser.get();
        PekProgram program = programService.getOrThrow(programId);
        accessService.requireProgramAccess(user.getId(), user.getRole(), program);
    }

    private void requireReportAccess(Long reportId) {
        User user = CurrentUser.get();
        PekReport report = reportService.getOrThrow(reportId);
        accessService.requireReportAccess(user.getId(), user.getRole(), report);
    }

    private void requireCompanyAccess(Long companyId) {
        User user = CurrentUser.get();
        accessService.requireCompanyAccess(user.getId(), user.getRole(), companyId);
    }

    private void requireObjectAccess(Long objectId) {
        User user = CurrentUser.get();
        accessService.requireObjectAccess(user.getId(), user.getRole(), objectId);
    }

    /** null = global access (unrestricted) - see PekAccessService#hasGlobalAccess. */
    private Set<Long> accessibleCompanyIds() {
        User user = CurrentUser.get();
        if (accessService.hasGlobalAccess(user.getRole())) {
            return null;
        }
        return accessService.resolveAccessibleCompanyIds(user.getId(), user.getRole());
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_COLLECT)
    @PostMapping("/reports/{reportId}/protocol-sources")
    public ApiResponse<PekApiDtos.ProtocolLinkResponse> createProtocolSource(
            @PathVariable Long reportId,
            @RequestBody PekApiDtos.CreateProtocolSourceRequest request) {
        requireReportAccess(reportId);
        return ApiResponse.ok(protocolLinkService.create(reportId, request, CurrentUser.get().getId()),
                "Связь протокола с ПЭК сохранена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/programs/{programId}/protocols")
    public ApiResponse<List<PekApiDtos.ProtocolLinkResponse>> protocolsByProgram(@PathVariable Long programId) {
        requireProgramAccess(programId);
        return ApiResponse.ok(protocolLinkService.listByProgram(programId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports/{reportId}/protocols")
    public ApiResponse<List<PekApiDtos.ProtocolLinkResponse>> protocolsByReport(@PathVariable Long reportId) {
        requireReportAccess(reportId);
        return ApiResponse.ok(protocolLinkService.listByReport(reportId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/control-items/{controlItemId}/protocols")
    public ApiResponse<List<PekApiDtos.ProtocolLinkResponse>> protocolsByControlItem(@PathVariable Long controlItemId) {
        PekProgramControlItem item = controlItemRepository.findById(controlItemId)
                .orElseThrow(() -> new kz.eco.common.exception.NotFoundException("Позиция контроля не найдена: " + controlItemId));
        requireProgramAccess(item.getProgramId());
        return ApiResponse.ok(protocolLinkService.listByControlItem(controlItemId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/dashboard")
    public ApiResponse<PekApiDtos.DashboardResponse> dashboard(
            @RequestParam(required = false) Long companyId, @RequestParam(required = false) Long objectId,
            @RequestParam(required = false) Integer year, @RequestParam(required = false) Integer quarter,
            @RequestParam(required = false) String status, @RequestParam(required = false) Long responsibleId) {
        if (companyId != null) {
            requireCompanyAccess(companyId);
        }
        return ApiResponse.ok(dashboardService.dashboard(companyId, objectId, year, quarter, status, responsibleId, accessibleCompanyIds()));
    }

    /** Must return only companyId's own staff, never a merged set across every company the caller
     *  happens to be a member of - requireCompanyAccess enforces the caller actually belongs to
     *  (or has global access to) that one company before the lookup runs. */
    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/lookups/assignees")
    public ApiResponse<List<PekApiDtos.AssigneeResponse>> assignees(
            @RequestParam Long companyId, @RequestParam String roles) {
        requireCompanyAccess(companyId);
        return ApiResponse.ok(lookupService.assignees(roles, Set.of(companyId)));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/lookups/objects/{objectId}/permits")
    public ApiResponse<List<PekApiDtos.PermitResponse>> permits(@PathVariable Long objectId) {
        requireObjectAccess(objectId);
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
        if (companyId != null) {
            requireCompanyAccess(companyId);
        }
        return ApiResponse.ok(programService.list(companyId, objectId, search, status, activeOn, responsibleUserId, page, size, sort, accessibleCompanyIds()));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/programs/{id}")
    public ApiResponse<PekApiDtos.ProgramResponse> getProgram(@PathVariable Long id) {
        requireProgramAccess(id);
        return ApiResponse.ok(programService.get(id));
    }

    /** Module fix item 4 ("backend readiness"): same evaluator submitReview/approve/activate gate
     *  on internally, now directly inspectable instead of only discoverable via a 409. */
    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/programs/{id}/readiness")
    public ApiResponse<PekApiDtos.ReadinessResponse> programReadiness(@PathVariable Long id) {
        requireProgramAccess(id);
        return ApiResponse.ok(programService.readiness(id));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_CREATE)
    @PostMapping("/programs")
    public ApiResponse<PekApiDtos.ProgramResponse> createProgram(@RequestBody PekApiDtos.CreateProgramRequest request) {
        if (request.companyId() != null) {
            requireCompanyAccess(request.companyId());
        }
        return ApiResponse.ok(programService.create(request, CurrentUser.get().getId()), "Программа ПЭК создана");
    }

    /** Full aggregate edit - only while the program is DRAFT/RETURNED (module spec §15/§16). */
    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PatchMapping("/programs/{id}")
    public ApiResponse<PekApiDtos.ProgramResponse> editProgram(
            @PathVariable Long id, @RequestBody PekApiDtos.EditProgramRequest request,
            @RequestHeader("If-Match") Long version) {
        requireProgramAccess(id);
        return ApiResponse.ok(programService.edit(id, request, version, CurrentUser.get().getId()), "Программа ПЭК изменена");
    }

    /** Same operation as editProgram, kept as a distinct path only because the frontend's autosave
     *  flow calls it on a timer with a header-only partial payload (controlItems/indicators/
     *  measures omitted -> left untouched, see EditProgramRequest javadoc) - not a second
     *  competing implementation, both delegate to the same PekProgramService#edit. */
    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PatchMapping("/programs/{id}/draft")
    public ApiResponse<PekApiDtos.ProgramResponse> autosaveProgramDraft(
            @PathVariable Long id, @RequestBody PekApiDtos.EditProgramRequest request,
            @RequestHeader("If-Match") Long version) {
        requireProgramAccess(id);
        return ApiResponse.ok(programService.edit(id, request, version, CurrentUser.get().getId()));
    }

    /** Only a DRAFT program can be deleted (module spec: nothing submitted for review yet, so there
     *  is no downstream state to preserve) - see {@link PekProgramService#delete}. */
    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @DeleteMapping("/programs/{id}")
    public ApiResponse<Void> deleteProgram(@PathVariable Long id, @RequestHeader("If-Match") Long version) {
        requireProgramAccess(id);
        programService.delete(id, version, CurrentUser.get().getId());
        return ApiResponse.ok(null, "Программа ПЭК удалена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping(value = "/programs/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<PekApiDtos.ProgramDocumentResponse> uploadProgramDocument(
            @PathVariable Long id, @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) String documentType) throws IOException {
        requireProgramAccess(id);
        return ApiResponse.ok(programService.uploadDocument(id, file, documentType, CurrentUser.get().getId()),
                "Документ загружен");
    }

    /** Always through this authorized endpoint - never a direct GridFS/filesystem URL (module spec
     *  §6.5, §18). */
    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/programs/{id}/documents/{documentId}")
    public ResponseEntity<InputStreamResource> downloadProgramDocument(
            @PathVariable Long id, @PathVariable Long documentId) throws IOException {
        requireProgramAccess(id);
        return fileResponse(programService.downloadDocument(id, documentId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping("/programs/{id}/submit-review")
    public ApiResponse<PekApiDtos.ProgramResponse> submitProgramForReview(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        requireProgramAccess(id);
        return ApiResponse.ok(programService.submitReview(id, version, CurrentUser.get().getId()), "Программа отправлена на проверку");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_REVIEW)
    @PostMapping("/programs/{id}/return")
    public ApiResponse<PekApiDtos.ProgramResponse> returnProgram(
            @PathVariable Long id, @RequestHeader("If-Match") Long version,
            @RequestBody PekApiDtos.ReturnProgramRequest request) {
        requireProgramAccess(id);
        return ApiResponse.ok(programService.returnProgram(id, version, request.reason(), CurrentUser.get().getId()),
                "Программа возвращена на доработку");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_APPROVE)
    @PostMapping("/programs/{id}/approve")
    public ApiResponse<PekApiDtos.ProgramResponse> approveProgram(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        requireProgramAccess(id);
        return ApiResponse.ok(programService.approve(id, version, CurrentUser.get().getId()), "Программа утверждена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_ACTIVATE)
    @PostMapping("/programs/{id}/activate")
    public ApiResponse<PekApiDtos.ProgramResponse> activateProgram(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        requireProgramAccess(id);
        return ApiResponse.ok(programService.activate(id, version, CurrentUser.get().getId()), "Программа ПЭК активирована");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_ARCHIVE)
    @PostMapping("/programs/{id}/archive")
    public ApiResponse<PekApiDtos.ProgramResponse> archiveProgram(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        requireProgramAccess(id);
        return ApiResponse.ok(programService.archive(id, version, CurrentUser.get().getId()), "Программа ПЭК архивирована");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_CREATE)
    @PostMapping("/programs/{id}/clone")
    public ApiResponse<PekApiDtos.ProgramResponse> cloneProgram(
            @PathVariable Long id, @RequestBody PekApiDtos.CloneProgramRequest request) {
        requireProgramAccess(id);
        return ApiResponse.ok(programService.clone(id, request, CurrentUser.get().getId()), "Программа скопирована");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/programs/{id}/history")
    public ApiResponse<List<PekApiDtos.ProgramHistoryEntry>> programHistory(@PathVariable Long id) {
        requireProgramAccess(id);
        return ApiResponse.ok(programService.history(id));
    }

    /** Module fix item 4: objectId/programId/status/issue are now all optional filters, applied in
     *  the repository query before pagination (see PekReportRepository#search) - totalElements/
     *  totalPages always reflect the filtered set, never the unfiltered one. */
    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports")
    public ApiResponse<kz.eco.common.PageResponse<PekApiDtos.ReportResponse>> listReports(
            @RequestParam Long companyId, @RequestParam(required = false) Long objectId,
            @RequestParam(required = false) Long programId, @RequestParam(required = false) String status,
            @RequestParam(required = false) String issue,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort) {
        requireCompanyAccess(companyId);
        return ApiResponse.ok(reportService.search(companyId, objectId, programId, status, issue, page, size, sort));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports/{id}")
    public ApiResponse<PekApiDtos.ReportResponse> getReport(@PathVariable Long id) {
        requireReportAccess(id);
        return ApiResponse.ok(reportService.get(id));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports/creation-context")
    public ApiResponse<PekApiDtos.ReportCreationContext> creationContext(
            @RequestParam Long companyId, @RequestParam Long objectId,
            @RequestParam String periodType, @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer quarter) {
        requireCompanyAccess(companyId);
        return ApiResponse.ok(reportService.creationContext(companyId, objectId, periodType, year, quarter));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_CREATE)
    @PostMapping("/reports")
    public ApiResponse<PekApiDtos.ReportResponse> createReport(@RequestBody PekApiDtos.CreateReportRequest request) {
        if (request.companyId() != null) {
            requireCompanyAccess(request.companyId());
        }
        return ApiResponse.ok(reportService.create(request, CurrentUser.get().getId()), "Отчёт ПЭК создан");
    }

    /** Module fix item 6: collect() is a mutation like every other report workflow endpoint - the
     *  client's version must be checked against the current one BEFORE collecting, not silently
     *  skipped or auto-refreshed to whatever the server currently has. */
    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_COLLECT)
    @PostMapping("/reports/{id}/collect")
    public ApiResponse<PekApiDtos.CollectionResult> collect(@PathVariable Long id,
                                                             @RequestHeader("If-Match") Long version) {
        requireReportAccess(id);
        return ApiResponse.ok(reportService.collect(id, version), "Сбор данных выполнен");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports/{id}/plan-fact")
    public ApiResponse<PekApiDtos.PlanFactResponse> planFact(@PathVariable Long id) {
        requireReportAccess(id);
        return ApiResponse.ok(reportService.getPlanFact(id));
    }

    /** Reconciliation detail behind the collect() summary counts (module report's API-changes
     *  section) - every filter optional. */
    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports/{id}/sources")
    public ApiResponse<List<PekApiDtos.ReportSourceItem>> reportSources(
            @PathVariable Long id, @RequestParam(required = false) String matchStatus,
            @RequestParam(required = false) Long protocolId, @RequestParam(required = false) Boolean excluded,
            @RequestParam(required = false) Boolean manual) {
        requireReportAccess(id);
        return ApiResponse.ok(reportService.getSources(id, matchStatus, protocolId, excluded, manual));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports/{id}/history")
    public ApiResponse<List<PekApiDtos.ReportHistoryEntry>> reportHistory(@PathVariable Long id) {
        requireReportAccess(id);
        return ApiResponse.ok(reportService.history(id));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports/{id}/sources/summary")
    public ApiResponse<PekApiDtos.SourceSummary> sourceSummary(@PathVariable Long id) {
        requireReportAccess(id);
        return ApiResponse.ok(reportService.sourceSummary(id));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/reports/{id}/sources/{sourceId}/match")
    public ApiResponse<PekApiDtos.ReportSourceItem> matchSource(@PathVariable Long id, @PathVariable Long sourceId,
                                                                @RequestBody PekApiDtos.MatchSourceRequest request,
                                                                @RequestHeader("If-Match") Long version) {
        requireReportAccess(id);
        return ApiResponse.ok(reportService.matchSource(id, sourceId, request, version));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/reports/{id}/sources/{sourceId}/exclude")
    public ApiResponse<PekApiDtos.ReportSourceItem> excludeSource(@PathVariable Long id, @PathVariable Long sourceId,
                                                                  @RequestBody PekApiDtos.SourceMutationRequest request,
                                                                  @RequestHeader("If-Match") Long version) {
        requireReportAccess(id);
        return ApiResponse.ok(reportService.excludeSource(id, sourceId, request, version));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_EDIT)
    @PostMapping("/reports/{id}/sources/{sourceId}/restore")
    public ApiResponse<PekApiDtos.ReportSourceItem> restoreSource(@PathVariable Long id, @PathVariable Long sourceId,
                                                                  @RequestBody PekApiDtos.SourceMutationRequest request,
                                                                  @RequestHeader("If-Match") Long version) {
        requireReportAccess(id);
        return ApiResponse.ok(reportService.restoreSource(id, sourceId, request, version));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/reports/{id}/readiness")
    public ApiResponse<PekApiDtos.ReadinessResponse> readiness(@PathVariable Long id) {
        requireReportAccess(id);
        return ApiResponse.ok(reportService.readiness(id));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_SUBMIT)
    @PostMapping("/reports/{id}/submit-review")
    public ApiResponse<PekApiDtos.ReportResponse> submitForReview(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        requireReportAccess(id);
        return ApiResponse.ok(reportService.submitForReview(id, version), "Отчёт отправлен на проверку");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_APPROVE)
    @PostMapping("/reports/{id}/approve")
    public ApiResponse<PekApiDtos.ReportResponse> approve(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        requireReportAccess(id);
        return ApiResponse.ok(reportService.approve(id, version), "Отчёт утверждён");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_RETURN)
    @PostMapping("/reports/{id}/return")
    public ApiResponse<PekApiDtos.ReportResponse> returnReport(@PathVariable Long id,
                                                               @RequestBody PekApiDtos.ReturnReportRequest request,
                                                               @RequestHeader("If-Match") Long version) {
        requireReportAccess(id);
        return ApiResponse.ok(reportService.returnForRevision(id, version, request.reason()));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REPORT_APPROVE)
    @PostMapping("/reports/{id}/archive")
    public ApiResponse<PekApiDtos.ReportResponse> archive(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        requireReportAccess(id);
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
