package kz.eco.protocol;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.protocol.dto.ProtocolApiDtos;
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

    public ProtocolController(ProtocolService protocolService, ProtocolExcelImportService excelImportService) {
        this.protocolService = protocolService;
        this.excelImportService = excelImportService;
    }

    @GetMapping("/templates")
    public ApiResponse<List<ProtocolApiDtos.ProtocolTemplateResponse>> templates() {
        return ApiResponse.ok(protocolService.listTemplates());
    }

    @GetMapping
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
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false, defaultValue = "false") boolean includeArchived) {
        return ApiResponse.ok(protocolService.list(search, status, templateId, subtype, companyId, objectId,
                laboratoryId, executorId, compliance, dateFrom, dateTo, page, size, sort, includeArchived));
    }

    @GetMapping("/{id}")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> get(@PathVariable Long id) {
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

    /** True physical delete - only an empty DRAFT, only ADMIN. Use POST /{id}/archive or
     *  POST /{id}/cancel for everything else (they keep the record as history). */
    @DeleteMapping("/{id}")
    @PreAuthorize(SecurityExpressions.ADMIN_ONLY)
    public ApiResponse<Void> delete(@PathVariable Long id) {
        protocolService.delete(id, CurrentUser.get().getId());
        return ApiResponse.ok(null, "Протокол удалён");
    }

    @GetMapping("/{id}/audit")
    public ApiResponse<List<ProtocolApiDtos.HistoryItem>> audit(@PathVariable Long id) {
        return ApiResponse.ok(protocolService.audit(id));
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

    @PostMapping("/{id}/sign")
    @PreAuthorize(SecurityExpressions.PROTOCOL_SUPERVISOR)
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
            @PathVariable Long id, @RequestBody(required = false) ProtocolApiDtos.VersionRequest request) {
        Long version = request != null ? request.version() : null;
        return ApiResponse.ok(protocolService.returnToDraft(id, version, CurrentUser.get().getId()), "Протокол возвращён в черновик");
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
    public ResponseEntity<InputStreamResource> preview(@PathVariable Long id) {
        byte[] content = protocolService.preview(id);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"preview.pdf\"")
                .body(new InputStreamResource(new java.io.ByteArrayInputStream(content)));
    }

    @PostMapping("/{id}/generate-docx")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> generateDocx(@PathVariable Long id) throws IOException {
        return ApiResponse.ok(protocolService.generateDocx(id, CurrentUser.get().getId()), "DOCX сформирован");
    }

    @PostMapping("/{id}/generate-pdf")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> generatePdf(@PathVariable Long id) throws IOException {
        return ApiResponse.ok(protocolService.generatePdf(id, CurrentUser.get().getId()), "PDF сформирован");
    }

    @GetMapping("/{id}/download-docx")
    public ResponseEntity<InputStreamResource> downloadDocx(@PathVariable Long id) throws IOException {
        return fileResponse(protocolService.downloadDocx(id, CurrentUser.get().getId()));
    }

    @GetMapping("/{id}/download-pdf")
    public ResponseEntity<InputStreamResource> downloadPdf(@PathVariable Long id) throws IOException {
        return fileResponse(protocolService.downloadPdf(id, CurrentUser.get().getId()));
    }

    @GetMapping("/{id}/download/docx")
    public ResponseEntity<InputStreamResource> downloadDocxRendered(@PathVariable Long id) throws IOException {
        return fileResponse(protocolService.downloadDocxRendered(id, CurrentUser.get().getId()));
    }

    @GetMapping("/{id}/download/pdf")
    public ResponseEntity<InputStreamResource> downloadPdfRendered(@PathVariable Long id) throws IOException {
        return fileResponse(protocolService.downloadPdfRendered(id, CurrentUser.get().getId()));
    }

    @PostMapping("/{id}/results")
    public ApiResponse<Map<String, Object>> addResult(@PathVariable Long id,
                                                      @RequestBody java.util.Map<String, Object> request) {
        return ApiResponse.ok(protocolService.addResult(id, request, CurrentUser.get().getId()), "Результат сохранён");
    }

    @PatchMapping("/{id}/results/{resultId}")
    public ApiResponse<Map<String, Object>> updateResult(@PathVariable Long id,
                                                         @PathVariable Long resultId,
                                                         @RequestBody java.util.Map<String, Object> request) {
        return ApiResponse.ok(protocolService.updateResult(id, resultId, request, CurrentUser.get().getId()), "Результат сохранён");
    }

    @DeleteMapping("/{id}/results/{resultId}")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> deleteResult(
            @PathVariable Long id, @PathVariable Long resultId,
            @RequestParam(required = false) Long version) {
        return ApiResponse.ok(protocolService.deleteResult(id, resultId, version, CurrentUser.get().getId()), "Строка удалена");
    }

    /** Atomic bulk operations on result rows (spec §13) - each applies to every listed row inside
     *  one transaction, or (on any error) to none of them. */
    @PatchMapping("/{id}/results/bulk-device")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> bulkUpdateDevice(
            @PathVariable Long id, @RequestBody ProtocolApiDtos.BulkDeviceUpdateRequest request) {
        return ApiResponse.ok(protocolService.bulkUpdateDevice(id, request.resultIds(), request.measurementDeviceId(),
                request.version(), CurrentUser.get().getId()), "Прибор обновлён для выбранных строк");
    }

    @PatchMapping("/{id}/results/bulk-place")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> bulkUpdatePlace(
            @PathVariable Long id, @RequestBody ProtocolApiDtos.BulkPlaceUpdateRequest request) {
        return ApiResponse.ok(protocolService.bulkUpdatePlace(id, request.resultIds(), request.measurementPlace(),
                request.version(), CurrentUser.get().getId()), "Место отбора обновлено для выбранных строк");
    }

    @DeleteMapping("/{id}/results/bulk")
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> bulkDeleteResults(
            @PathVariable Long id, @RequestBody ProtocolApiDtos.BulkDeleteResultsRequest request) {
        return ApiResponse.ok(protocolService.bulkDeleteResults(id, request.resultIds(), request.version(),
                CurrentUser.get().getId()), "Строки удалены");
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
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> refreshLaboratoryData(@PathVariable Long id) {
        return ApiResponse.ok(protocolService.refreshLaboratoryData(id, CurrentUser.get().getId()), "Данные лаборатории обновлены");
    }

    @PostMapping(value = "/{id}/import-excel", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<ProtocolApiDtos.ProtocolResponse> importExcel(@PathVariable Long id,
                                                                   @RequestPart("file") MultipartFile file) throws IOException {
        return ApiResponse.ok(excelImportService.importExcel(id, file, CurrentUser.get().getId()));
    }

    private ResponseEntity<InputStreamResource> fileResponse(StoredFileContent file) {
        String encoded = URLEncoder.encode(file.filename(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
                .body(new InputStreamResource(file.inputStream()));
    }
}
