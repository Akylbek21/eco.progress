package kz.eco.pek;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.pek.dto.PekApiDtos;
import kz.eco.user.User;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Full CRUD + status workflow for {@link PekEnvironmentalPermit} (Iteration 2 of the PEK module
 * overhaul). Kept as its own controller (same precedent as {@link PekSettingsController}, a
 * distinct sub-resource controller rather than folding into the already-large
 * {@link PekController}) - every mutation goes through {@link PekAccessService} exactly like
 * PekController's program/report endpoints do, never bypassed.
 */
@RestController
@RequestMapping("/api/pek/permits")
public class PekPermitController {

    private final PekPermitService permitService;
    private final PekAccessService accessService;

    public PekPermitController(PekPermitService permitService, PekAccessService accessService) {
        this.permitService = permitService;
        this.accessService = accessService;
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping
    public ApiResponse<List<PekApiDtos.PermitResponse>> listByObject(@RequestParam Long objectId) {
        requireObjectAccess(objectId);
        return ApiResponse.ok(permitService.listByObject(objectId));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/{id}")
    public ApiResponse<PekApiDtos.PermitResponse> get(@PathVariable Long id) {
        requirePermitAccess(id);
        return ApiResponse.ok(permitService.get(id));
    }

    /** Upload-first flow: store the file, hand the fileId back, and the caller passes it into
     *  create/update afterward. When permitId is supplied (replacing an existing permit's file),
     *  If-Match is mandatory so a stale client can't upload against a permit that has since
     *  changed; for a brand-new permit (no permitId yet) only companyId is required. */
    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping(value = "/files", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<PekApiDtos.PermitFileUploadResponse> uploadFile(
            @RequestParam Long companyId,
            @RequestParam(required = false) Long permitId,
            @RequestHeader(value = "If-Match", required = false) Long version,
            @RequestPart("file") org.springframework.web.multipart.MultipartFile file) throws java.io.IOException {
        if (permitId != null) {
            requirePermitAccess(permitId);
            if (version == null) {
                throw new kz.eco.common.exception.BadRequestException(
                        "Требуется заголовок If-Match при замене файла существующего разрешения", "VERSION_REQUIRED");
            }
        } else {
            requireCompanyAccess(companyId);
        }
        return ApiResponse.ok(permitService.uploadFile(companyId, permitId, version, file, CurrentUser.get().getId()),
                "Файл загружен");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping
    public ApiResponse<PekApiDtos.PermitResponse> create(@RequestBody PekApiDtos.CreatePermitRequest request) {
        if (request.companyId() != null) {
            requireCompanyAccess(request.companyId());
        }
        return ApiResponse.ok(permitService.create(request, CurrentUser.get().getId()), "Разрешение создано");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PatchMapping("/{id}")
    public ApiResponse<PekApiDtos.PermitResponse> update(@PathVariable Long id,
                                                          @RequestBody PekApiDtos.UpdatePermitRequest request,
                                                          @RequestHeader("If-Match") Long version) {
        requirePermitAccess(id);
        return ApiResponse.ok(permitService.update(id, request, version, CurrentUser.get().getId()), "Разрешение изменено");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_PROGRAM_EDIT)
    @PostMapping("/{id}/status")
    public ApiResponse<PekApiDtos.PermitResponse> changeStatus(@PathVariable Long id,
                                                                @RequestBody PekApiDtos.ChangePermitStatusRequest request,
                                                                @RequestHeader("If-Match") Long version) {
        requirePermitAccess(id);
        return ApiResponse.ok(permitService.changeStatus(id, request, version, CurrentUser.get().getId()), "Статус разрешения изменён");
    }

    /**
     * Dedicated, ownership-checked download of the permit's file. Deliberately NOT routed through
     * the generic /api/files/documents/{fileId} endpoint: here the fileId is resolved from the
     * permit row itself after the company check, so a cross-tenant fileId cannot be substituted.
     * 404 when the permit does not exist or carries no readable file; 403 for another company.
     */
    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/{id}/file")
    public org.springframework.http.ResponseEntity<org.springframework.core.io.InputStreamResource> downloadFile(
            @PathVariable Long id) {
        requirePermitAccess(id);
        kz.eco.storage.StoredFileContent file = permitService.downloadFile(id);
        String filename = file.filename() == null || file.filename().isBlank() ? "permit" : file.filename();
        String encoded = java.net.URLEncoder.encode(filename, java.nio.charset.StandardCharsets.UTF_8)
                .replace("+", "%20");
        String contentType = file.contentType() == null || file.contentType().isBlank()
                ? org.springframework.http.MediaType.APPLICATION_OCTET_STREAM_VALUE : file.contentType();
        return org.springframework.http.ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.parseMediaType(contentType))
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename*=UTF-8''" + encoded)
                .body(new org.springframework.core.io.InputStreamResource(file.inputStream()));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    @GetMapping("/{id}/history")
    public ApiResponse<List<PekApiDtos.PermitHistoryEntry>> history(@PathVariable Long id) {
        requirePermitAccess(id);
        return ApiResponse.ok(permitService.history(id));
    }

    private void requirePermitAccess(Long permitId) {
        User user = CurrentUser.get();
        PekEnvironmentalPermit permit = permitService.getOrThrow(permitId);
        accessService.requireCompanyAccess(user.getId(), user.getRole(), permit.getCompanyId());
    }

    private void requireObjectAccess(Long objectId) {
        User user = CurrentUser.get();
        accessService.requireObjectAccess(user.getId(), user.getRole(), objectId);
    }

    private void requireCompanyAccess(Long companyId) {
        User user = CurrentUser.get();
        accessService.requireCompanyAccess(user.getId(), user.getRole(), companyId);
    }
}
