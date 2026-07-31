package kz.eco.laboratory;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.common.exception.BadRequestException;
import kz.eco.laboratory.dto.LaboratoryDtos;
import kz.eco.storage.StoredFileContent;
import kz.eco.user.SecurityExpressions;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/** Settings-scoped laboratory endpoints, matching the frontend's /api/settings/... base path. */
@RestController
@RequestMapping("/api/settings/laboratories")
@PreAuthorize(SecurityExpressions.LAB_SETTINGS_READ)
public class SettingsLaboratoryController {

    private final LaboratoryService laboratoryService;

    public SettingsLaboratoryController(LaboratoryService laboratoryService) {
        this.laboratoryService = laboratoryService;
    }

    @GetMapping("/default")
    public ApiResponse<LaboratoryDtos.LaboratoryResponse> getDefault() {
        return ApiResponse.ok(laboratoryService.getDefault());
    }

    @GetMapping("/{id:\\d+}")
    public ApiResponse<LaboratoryDtos.LaboratoryResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(laboratoryService.get(id));
    }

    @PostMapping(value = "/{id:\\d+}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize(SecurityExpressions.LAB_LOGO_MANAGE)
    public ApiResponse<LaboratoryDtos.LaboratoryResponse> uploadLogo(
            @PathVariable Long id,
            @RequestParam(value = "logo", required = false) MultipartFile logo,
            @RequestParam(value = "file", required = false) MultipartFile file) {
        MultipartFile upload = logo != null && !logo.isEmpty() ? logo : file;
        if (upload == null || upload.isEmpty()) {
            throw new BadRequestException("Файл логотипа не передан");
        }
        Long userId = CurrentUser.get().getId();
        return ApiResponse.ok(laboratoryService.uploadLogo(id, upload, userId), "Логотип лаборатории обновлён");
    }

    @GetMapping("/{id:\\d+}/logo")
    public ResponseEntity<InputStreamResource> getLogo(@PathVariable Long id) throws IOException {
        StoredFileContent content = laboratoryService.loadLogo(id);
        String filename = content.filename() != null ? content.filename() : "logo";
        String encodedFilename = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(content.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + filename + "\"; filename*=UTF-8''" + encodedFilename)
                .body(new InputStreamResource(content.inputStream()));
    }

    @DeleteMapping("/{id:\\d+}/logo")
    @PreAuthorize(SecurityExpressions.LAB_LOGO_MANAGE)
    public ApiResponse<LaboratoryDtos.LaboratoryResponse> deleteLogo(@PathVariable Long id) {
        return ApiResponse.ok(laboratoryService.removeLogo(id), "Логотип лаборатории удалён");
    }
}
