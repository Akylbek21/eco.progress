package kz.eco.pek;

import kz.eco.common.ApiResponse;
import kz.eco.pek.dto.PekSettingsDtos;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/pek/settings")
public class PekSettingsController {
    private final PekSettingsService service;
    public PekSettingsController(PekSettingsService service) { this.service=service; }

    /** companyId is optional - a caller with membership in exactly one company (the common case)
     *  needs it implicitly resolved (see PekAccessService#resolveSingleCompanyId); a global-access
     *  caller (ADMIN/DIRECTOR) or a caller in several companies must specify it explicitly. */
    @GetMapping
    @PreAuthorize(PekSecurityExpressions.PEK_SETTINGS_VIEW)
    public ApiResponse<PekSettingsDtos.Response> get(@RequestParam(required = false) Long companyId) {
        return ApiResponse.ok(service.getCurrentCompanySettings(companyId), "OK");
    }

    @PutMapping
    @PreAuthorize(PekSecurityExpressions.PEK_SETTINGS_EDIT)
    public ApiResponse<PekSettingsDtos.Response> update(@RequestBody PekSettingsDtos.UpdateRequest request,
                                                          @RequestParam(required = false) Long companyId,
                                                          @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(service.updateSettings(request, companyId, version), "Настройки ПЭК сохранены");
    }
}
