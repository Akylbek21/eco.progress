package kz.eco.protocol;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.protocol.dto.ProtocolApiDtos;
import kz.eco.protocol.dto.ProtocolPekCreationDtos;
import kz.eco.pek.PekProtocolLinkService;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.storage.StoredFileContent;
import kz.eco.user.SecurityExpressions;
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
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/protocols")
@PreAuthorize(SecurityExpressions.LAB_PROTOCOL)
public class ProtocolController {

    private final ProtocolService protocolService;
    private final ProtocolExcelImportService excelImportService;
    private final PekProtocolLinkService pekProtocolLinkService;
    private final ProtocolAccessService accessService;
    private final ProtocolPekCreationService pekCreationService;

    public ProtocolController(ProtocolService protocolService, ProtocolExcelImportService excelImportService,
                              PekProtocolLinkService pekProtocolLinkService, ProtocolAccessService accessService,
                              ProtocolPekCreationService pekCreationService) {
        this.protocolService = protocolService;
        this.excelImportService = excelImportService;
        this.pekProtocolLinkService = pekProtocolLinkService;
        this.accessService = accessService;
        this.pekCreationService = pekCreationService;
    }

    /** Same read access as GET /{id} (module fix): MANAGER/ACCOUNTANT/ECOLOGIST/WASTE_SPECIALIST
     *  may view a protocol's PEK links but never create/update/delete them - those three endpoints
     *  below intentionally keep the class-level LAB_PROTOCOL gate (ADMIN/DIRECTOR/HEAD/LABORATORY
     *  only), unchanged. assertCanView both authenticates the caller against this specific protocol
     *  and its company - the same check GET /{id} performs - on top of PekProtocolLinkService.list's
     *  own independent company-scope check. */
    @GetMapping("/{id}/pek-links")
    @PreAuthorize(SecurityExpressions.PROTOCOL_VIEW)
    public ApiResponse<List<PekApiDtos.ProtocolLinkResponse>> pekLinks(@PathVariable Long id) {
        accessService.assertCanView(CurrentUser.get().getId(), id);
        return ApiResponse.ok(pekProtocolLinkService.list(id));
    }

    @PostMapping("/{id}/pek-links")
    public ApiResponse<PekApiDtos.ProtocolLinkResponse> createPekLink(
            @PathVariable Long id,
            @RequestBody PekApiDtos.CreateProtocolPekLinkRequest request) {
        return ApiResponse.ok(pekProtocolLinkService.createFromPekContext(id, request, CurrentUser.get().getId()),
                "Связь ПЭК создана");
    }

    @PutMapping("/{id}/pek-links/{linkId}")
    public ApiResponse<PekApiDtos.ProtocolLinkResponse> updatePekLink(
            @PathVariable Long id,
            @PathVariable Long linkId,
            @RequestBody PekApiDtos.UpdateProtocolPekLinkRequest request,
            @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(pekProtocolLinkService.update(id, linkId, request, version, CurrentUser.get().getId()),
                "Связь ПЭК обновлена");
    }

    @DeleteMapping("/{id}/pek-links/{linkId}")
    public ApiResponse<Void> deletePekLink(@PathVariable Long id, @PathVariable Long linkId) {
        pekProtocolLinkService.delete(id, linkId);
        return ApiResponse.ok(null, "Связь ПЭК удалена");
    }

    /**
     * Blocker 1: what the ПЭК programme requires for this company/object on this date, and which
     * of those requirements are still outstanding. Everything is resolved from the real programme
     * (monitoring directions, control items, frequency, points, indicators) and from the protocols
     * already linked through the canonical PEK link table.
     */
    @GetMapping("/creation-context")
    public ApiResponse<ProtocolPekCreationDtos.CreationContextResponse> creationContext(
            @RequestParam Long companyId,
            @RequestParam Long objectId,
            @RequestParam @org.springframework.format.annotation.DateTimeFormat(
                    iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date) {
        return ApiResponse.ok(pekCreationService.creationContext(companyId, objectId, date, CurrentUser.get()));
    }

    /** Blocker 1: turn exactly one outstanding ПЭК requirement into a real DRAFT protocol plus its
     *  canonical PEK link. Duplicate creation is prevented by a DB unique index, not by a
     *  find-then-save check - see ProtocolPekCreationService. */
    @PostMapping("/from-pek")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> createFromPek(
            @RequestBody ProtocolPekCreationDtos.CreateProtocolFromPekRequest request) {
        return ApiResponse.ok(pekCreationService.createFromPek(request, CurrentUser.get()),
                "Черновик протокола создан из требования ПЭК");
    }

    @GetMapping("/templates")
    public ApiResponse<List<ProtocolApiDtos.ProtocolTemplateResponse>> templates() {
        return ApiResponse.ok(protocolService.listTemplates());
    }

    @GetMapping
    @PreAuthorize(SecurityExpressions.PROTOCOL_VIEW)
    public ApiResponse<kz.eco.common.PageResponse<ProtocolApiDtos.ProtocolListItemDto>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ProtocolStatus status,
            @RequestParam(required = false) String templateId,
            @RequestParam(required = false) String subtype,
            @RequestParam(required = false) Long companyId,
            @RequestParam(required = false) Long objectId,
            @RequestParam(required = false) Long laboratoryId,
            @RequestParam(required = false) Long executorId,
            @RequestParam(required = false) String compliance,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate dateFrom,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate dateTo,
            @RequestParam(required = false) Boolean published,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false, defaultValue = "false") boolean includeArchived) {
        return ApiResponse.ok(protocolService.list(search, status, templateId, subtype, companyId, objectId,
                laboratoryId, executorId, compliance, dateFrom, dateTo, published, page, size, sort, includeArchived));
    }

    @GetMapping("/{id}")
    @PreAuthorize(SecurityExpressions.PROTOCOL_VIEW)
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> get(@PathVariable Long id) {
        accessService.assertCanView(CurrentUser.get().getId(), id);
        return ApiResponse.ok(protocolService.get(id));
    }

    @PostMapping
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> create(@RequestBody ProtocolApiDtos.CreateProtocolRequest request) {
        return ApiResponse.ok(protocolService.create(request, CurrentUser.get().getId()), "Протокол создан");
    }

    /** Idempotency-Key (optional): a client retry (double-click, network-timeout resend) with the
     *  same key and the same body returns the original result instead of creating a second
     *  protocol - see ProtocolIdempotencyService. */
    @PostMapping("/quick-create")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> quickCreate(
            @RequestBody ProtocolApiDtos.QuickCreateProtocolRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return ApiResponse.ok(protocolService.quickCreate(request, CurrentUser.get().getId(), idempotencyKey),
                "Протокол создан");
    }

    @PatchMapping("/{id}")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> update(@PathVariable Long id,
                                                                @RequestBody ProtocolApiDtos.UpdateProtocolRequest request) {
        return ApiResponse.ok(protocolService.update(id, request, CurrentUser.get().getId()), "Протокол обновлён");
    }

    /** Module spec §1: only templateId is required - no measurements, normative, device, company
     *  or object required. Creates and stays in DRAFT with no strict validation and no
     *  normative check. Fill it in incrementally via PATCH /{id}/draft. */
    @PostMapping("/drafts")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> createDraft(
            @RequestBody ProtocolApiDtos.CreateProtocolDraftRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return ApiResponse.ok(protocolService.createDraft(request, CurrentUser.get().getId(), idempotencyKey),
                "Черновик создан");
    }

    /** Same partial-update semantics as PATCH /{id} - kept as a distinct, explicitly-named route
     *  per module spec §1 so the draft-editing workflow step is unambiguous in the API surface. */
    @PatchMapping("/{id}/draft")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> updateDraft(@PathVariable Long id,
                                                                     @RequestBody ProtocolApiDtos.UpdateProtocolRequest request) {
        return ApiResponse.ok(protocolService.update(id, request, CurrentUser.get().getId()), "Черновик обновлён");
    }

    /** Empty DRAFT -> true physical delete. Filled, unsigned, unpublished protocol -> soft delete
     *  (deletedAt set, hidden from GET /api/protocols, record kept for history/audit). Signed or
     *  published -> 409. See Protocol.isDeletable() for the exact rule, shared with
     *  ProtocolPermissionService so the canDelete flag the frontend renders never drifts from what
     *  this endpoint actually enforces. Available to every LAB_PROTOCOL role (class-level
     *  @PreAuthorize already covers ADMIN/DIRECTOR/HEAD/LABORATORY), not ADMIN-only. */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id, @RequestParam(required = false) Long version) {
        protocolService.delete(id, version, CurrentUser.get().getId());
        return ApiResponse.ok(null, "Протокол удалён");
    }

    @GetMapping("/{id}/audit")
    @PreAuthorize(SecurityExpressions.PROTOCOL_VIEW)
    public ApiResponse<List<ProtocolApiDtos.HistoryItem>> audit(@PathVariable Long id) {
        return ApiResponse.ok(protocolService.audit(id, CurrentUser.get().getId()));
    }

    @PostMapping("/{id}/ready-for-approval")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> readyForApproval(
            @PathVariable Long id, @RequestBody(required = false) ProtocolApiDtos.VersionRequest request) {
        Long version = request != null ? request.version() : null;
        return ApiResponse.ok(protocolService.readyForApproval(id, version, CurrentUser.get().getId()),
                "Протокол готов к утверждению");
    }

    /** Canonical "return for revision" (-> NEEDS_REVISION), distinct from the older, coarser
     *  return-to-draft below (kept for backward compatibility). "reason" is the canonical field
     *  name; "comment" is still accepted via @JsonAlias for older frontend builds (see
     *  ProtocolApiDtos.ReturnForRevisionRequest), but only "reason" is ever echoed back. */
    @PostMapping("/{id}/return-for-revision")
    @PreAuthorize(SecurityExpressions.PROTOCOL_SUPERVISOR)
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> returnForRevision(
            @PathVariable Long id, @RequestBody(required = false) ProtocolApiDtos.ReturnForRevisionRequest request) {
        Long version = request != null ? request.version() : null;
        String reason = request != null ? request.reason() : null;
        return ApiResponse.ok(protocolService.returnForRevision(id, version, reason, CurrentUser.get().getId()),
                "Протокол возвращён на доработку");
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize(SecurityExpressions.PROTOCOL_SUPERVISOR)
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> approve(
            @PathVariable Long id, @RequestBody(required = false) ProtocolApiDtos.VersionRequest request) throws IOException {
        Long version = request != null ? request.version() : null;
        return ApiResponse.ok(protocolService.approve(id, version, CurrentUser.get().getId()), "Протокол утверждён");
    }

    /** Module spec item 1: a lab executor may complete and sign a protocol independently
     *  (READY -&gt; SIGNED) without a supervisor's approval - LAB_PROTOCOL (not the narrower
     *  PROTOCOL_SUPERVISOR) so LABORATORY can call this. The APPROVED -&gt; SIGNED path still exists
     *  unchanged for protocols that did go through the full review cycle, since only a supervisor
     *  can ever get a protocol into APPROVED in the first place (approve() above stays
     *  PROTOCOL_SUPERVISOR-gated) - opening this endpoint doesn't change who can approve. */
    @PostMapping("/{id}/sign")
    @PreAuthorize(SecurityExpressions.LAB_PROTOCOL)
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> sign(@PathVariable Long id,
                                                            @RequestBody(required = false) ProtocolApiDtos.SignProtocolRequest request) throws IOException {
        return ApiResponse.ok(protocolService.sign(id, request, CurrentUser.get().getId()), "Протокол подписан");
    }

    /** Correction workflow: creates a new DRAFT linked to this (now REPLACED) protocol. */
    @PostMapping("/{id}/replace")
    @PreAuthorize(SecurityExpressions.PROTOCOL_SUPERVISOR)
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> replace(@PathVariable Long id,
                                                                 @RequestBody ProtocolApiDtos.ReplaceProtocolRequest request) {
        return ApiResponse.ok(protocolService.replace(id, request, CurrentUser.get().getId()), "Создана исправленная версия");
    }

    /** Same operation, alias path matching the spec's endpoint contract. */
    @PostMapping("/{id}/corrections")
    @PreAuthorize(SecurityExpressions.PROTOCOL_SUPERVISOR)
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> createCorrection(@PathVariable Long id,
                                                                 @RequestBody ProtocolApiDtos.ReplaceProtocolRequest request) {
        return ApiResponse.ok(protocolService.replace(id, request, CurrentUser.get().getId()), "Создана исправленная версия");
    }

    @PostMapping("/{id}/return-to-draft")
    @PreAuthorize(SecurityExpressions.PROTOCOL_SUPERVISOR)
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> returnToDraft(
            @PathVariable Long id, @RequestBody(required = false) ProtocolApiDtos.ReturnToDraftRequest request) {
        Long version = request != null ? request.version() : null;
        String reason = request != null ? request.reason() : null;
        return ApiResponse.ok(protocolService.returnToDraft(id, version, reason, CurrentUser.get().getId()), "Протокол возвращён в черновик");
    }

    /** "reason" is the canonical field name; "comment" is still accepted via @JsonAlias for older
     *  frontend builds (see ProtocolApiDtos.CancelProtocolRequest). */
    @PostMapping("/{id}/cancel")
    @PreAuthorize(SecurityExpressions.PROTOCOL_SUPERVISOR)
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> cancel(
            @PathVariable Long id, @RequestBody(required = false) ProtocolApiDtos.CancelProtocolRequest request) {
        Long version = request != null ? request.version() : null;
        String reason = request != null ? request.reason() : null;
        return ApiResponse.ok(protocolService.cancel(id, version, reason, CurrentUser.get().getId()), "Протокол аннулирован");
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize(SecurityExpressions.PROTOCOL_SUPERVISOR)
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> archive(
            @PathVariable Long id, @RequestBody(required = false) ProtocolApiDtos.VersionRequest request) {
        Long version = request != null ? request.version() : null;
        return ApiResponse.ok(protocolService.archive(id, version, CurrentUser.get().getId()), "Протокол архивирован");
    }

    /** Publishes the signed final PDF to the client (spec §26) - SIGNED-only, hash-checked. */
    @PostMapping("/{id}/publish-to-client")
    @PreAuthorize(SecurityExpressions.PROTOCOL_SUPERVISOR)
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> publishToClient(
            @PathVariable Long id, @RequestBody(required = false) ProtocolApiDtos.PublishToClientRequest request) {
        Long version = request != null ? request.version() : null;
        return ApiResponse.ok(protocolService.publishToClient(id, version, CurrentUser.get().getId()),
                "Протокол опубликован клиенту");
    }

    @GetMapping("/{id}/preview")
    public ResponseEntity<InputStreamResource> preview(@PathVariable Long id) throws IOException {
        byte[] content = protocolService.preview(id, CurrentUser.get().getId());
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"preview.pdf\"")
                .body(new InputStreamResource(new java.io.ByteArrayInputStream(content)));
    }

    @PostMapping("/{id}/generate-docx")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> generateDocx(
            @PathVariable Long id, @RequestBody(required = false) ProtocolApiDtos.VersionRequest request) throws IOException {
        Long version = request != null ? request.version() : null;
        return ApiResponse.ok(protocolService.generateDocx(id, version, CurrentUser.get().getId()), "DOCX сформирован");
    }

    @PostMapping("/{id}/generate-pdf")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> generatePdf(
            @PathVariable Long id, @RequestBody(required = false) ProtocolApiDtos.VersionRequest request) throws IOException {
        Long version = request != null ? request.version() : null;
        return ApiResponse.ok(protocolService.generatePdf(id, version, CurrentUser.get().getId()), "PDF сформирован");
    }

    @GetMapping("/{id}/download-docx")
    public ResponseEntity<InputStreamResource> downloadDocx(@PathVariable Long id) throws IOException {
        return fileResponse(protocolService.downloadDocx(id, CurrentUser.get().getId()));
    }

    @GetMapping("/{id}/download-pdf")
    public ResponseEntity<InputStreamResource> downloadPdf(@PathVariable Long id) throws IOException {
        return fileResponse(protocolService.downloadPdf(id, CurrentUser.get().getId()));
    }

    /** @deprecated Use GET /{id}/download-docx — this on-demand render endpoint is closed. */
    @GetMapping("/{id}/download/docx")
    public ResponseEntity<?> downloadDocxRendered(@PathVariable Long id) {
        return gone("Используйте GET /api/protocols/{id}/download-docx");
    }

    /** @deprecated Use GET /{id}/download-pdf — this on-demand render endpoint is closed. */
    @GetMapping("/{id}/download/pdf")
    public ResponseEntity<?> downloadPdfRendered(@PathVariable Long id) {
        return gone("Используйте GET /api/protocols/{id}/download-pdf");
    }

    /** @deprecated Use PATCH /{id}/draft-results — individual result add is closed. */
    @PostMapping("/{id}/results")
    public ResponseEntity<?> addResult(@PathVariable Long id) {
        return gone("Используйте PATCH /api/protocols/{id}/draft-results");
    }

    /** @deprecated Use PATCH /{id}/draft-results — individual result update is closed. */
    @PatchMapping("/{id}/results/{resultId}")
    public ResponseEntity<?> updateResult(@PathVariable Long id, @PathVariable Long resultId) {
        return gone("Используйте PATCH /api/protocols/{id}/draft-results");
    }

    /** @deprecated Use PATCH /{id}/draft-results — individual result delete is closed. */
    @DeleteMapping("/{id}/results/{resultId}")
    public ResponseEntity<?> deleteResult(@PathVariable Long id, @PathVariable Long resultId) {
        return gone("Используйте PATCH /api/protocols/{id}/draft-results");
    }

    /** Atomic add/update/delete of result rows in one request (draft-results batch) - one
     *  version check, one contentVersion/JPA-version bump, one audit entry, all-or-nothing.
     *  Idempotency-Key (optional): a retried request with the same key returns the original
     *  result instead of re-applying the batch - see ProtocolIdempotencyService. */
    @PatchMapping("/{id}/draft-results")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> saveDraftResultsBatch(
            @PathVariable Long id,
            @RequestBody ProtocolApiDtos.DraftResultsBatchRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return ApiResponse.ok(
                protocolService.saveDraftResultsBatch(id, request, CurrentUser.get().getId(), idempotencyKey),
                "Результаты сохранены");
    }

    /** @deprecated Use PATCH /{id}/draft-results — bulk-device is closed. */
    @PatchMapping("/{id}/results/bulk-device")
    public ResponseEntity<?> bulkUpdateDevice(@PathVariable Long id) {
        return gone("Используйте PATCH /api/protocols/{id}/draft-results");
    }

    /** @deprecated Use PATCH /{id}/draft-results — bulk-place is closed. */
    @PatchMapping("/{id}/results/bulk-place")
    public ResponseEntity<?> bulkUpdatePlace(@PathVariable Long id) {
        return gone("Используйте PATCH /api/protocols/{id}/draft-results");
    }

    /** @deprecated Use PATCH /{id}/draft-results — bulk-delete is closed. */
    @DeleteMapping("/{id}/results/bulk")
    public ResponseEntity<?> bulkDeleteResults(@PathVariable Long id) {
        return gone("Используйте PATCH /api/protocols/{id}/draft-results");
    }

    @PostMapping("/{id}/measurement-devices")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> attachMeasurementDevice(
            @PathVariable Long id,
            @RequestBody ProtocolApiDtos.AttachMeasurementDeviceRequest request) {
        return ApiResponse.ok(protocolService.attachMeasurementDevice(id, request, CurrentUser.get().getId()), "Прибор прикреплён");
    }

    @DeleteMapping("/{id}/measurement-devices/{deviceId}")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> detachMeasurementDevice(
            @PathVariable Long id,
            @PathVariable Long deviceId,
            @RequestParam(required = false) Long version) {
        return ApiResponse.ok(protocolService.detachMeasurementDevice(id, deviceId, version, CurrentUser.get().getId()), "Прибор удалён");
    }

    @PostMapping("/{id}/check-normatives")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> checkNormatives(
            @PathVariable Long id, @RequestBody(required = false) ProtocolApiDtos.VersionRequest request) {
        Long version = request != null ? request.version() : null;
        return ApiResponse.ok(protocolService.checkNormatives(id, version, CurrentUser.get().getId()), "Проверка нормативов выполнена");
    }

    @PostMapping("/{id}/refresh-laboratory-data")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> refreshLaboratoryData(
            @PathVariable Long id, @RequestBody(required = false) ProtocolApiDtos.VersionRequest request) {
        Long version = request != null ? request.version() : null;
        return ApiResponse.ok(protocolService.refreshLaboratoryData(id, version, CurrentUser.get().getId()), "Данные лаборатории обновлены");
    }

    @PostMapping(value = "/{id}/import-excel", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> importExcel(@PathVariable Long id,
                                                                   @RequestPart("file") MultipartFile file,
                                                                   @RequestPart("version") Long version) throws IOException {
        return ApiResponse.ok(excelImportService.importExcel(id, file, version, CurrentUser.get().getId()));
    }

    private ResponseEntity<InputStreamResource> fileResponse(StoredFileContent file) {
        String encoded = URLEncoder.encode(file.filename(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .body(new InputStreamResource(file.inputStream()));
    }

    private static ResponseEntity<Map<String, String>> gone(String message) {
        return ResponseEntity.status(org.springframework.http.HttpStatus.GONE)
                .body(Map.of("message", message, "code", "ENDPOINT_REMOVED"));
    }
}
