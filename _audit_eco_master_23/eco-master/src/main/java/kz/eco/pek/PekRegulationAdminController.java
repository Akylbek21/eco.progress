package kz.eco.pek;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.pek.dto.PekRegulationAdminDtos;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * "Настройка ПЭК" → "Нормативная база" / "Сроки сдачи" - global (not tenant-scoped) admin
 * configuration, item 9: reads are open to any PEK staff member ({@link PekSecurityExpressions#PEK_REGULATION_VIEW}),
 * writes require {@link PekSecurityExpressions#PEK_REGULATION_ADMIN} and accept no companyId - see
 * that constant's javadoc for why this is intentionally separate from the tenant-scoped
 * {@code PEK_SETTINGS_EDIT} used by {@link PekSettingsController}.
 */
@RestController
@RequestMapping("/api/pek/admin/regulation")
public class PekRegulationAdminController {

    private final PekRegulationAdminService service;

    public PekRegulationAdminController(PekRegulationAdminService service) {
        this.service = service;
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REGULATION_VIEW)
    @GetMapping("/versions")
    public ApiResponse<java.util.List<PekRegulationAdminDtos.RegulationVersionResponse>> listVersions() {
        return ApiResponse.ok(service.listRegulationVersions());
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REGULATION_ADMIN)
    @PostMapping("/versions")
    public ApiResponse<PekRegulationAdminDtos.RegulationVersionResponse> createVersion(
            @RequestBody PekRegulationAdminDtos.CreateRegulationVersionRequest request) {
        return ApiResponse.ok(service.createRegulationVersion(request, CurrentUser.get().getId()),
                "Версия нормативной базы создана");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REGULATION_ADMIN)
    @PostMapping("/versions/{id}/activate")
    public ApiResponse<PekRegulationAdminDtos.RegulationVersionResponse> activateVersion(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(service.activateRegulationVersion(id, version, CurrentUser.get().getId()),
                "Версия нормативной базы сделана действующей");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REGULATION_ADMIN)
    @PostMapping("/versions/{id}/archive")
    public ApiResponse<PekRegulationAdminDtos.RegulationVersionResponse> archiveVersion(
            @PathVariable Long id, @RequestHeader("If-Match") Long version) {
        return ApiResponse.ok(service.archiveRegulationVersion(id, version, CurrentUser.get().getId()),
                "Версия нормативной базы архивирована");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REGULATION_ADMIN)
    @DeleteMapping("/versions/{id}")
    public ApiResponse<Void> deleteVersion(@PathVariable Long id, @RequestHeader("If-Match") Long version) {
        service.deleteRegulationVersion(id, version, CurrentUser.get().getId());
        return ApiResponse.ok(null, "Версия нормативной базы удалена");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REGULATION_VIEW)
    @GetMapping("/deadline-rules")
    public ApiResponse<java.util.List<PekRegulationAdminDtos.DeadlineRuleResponse>> listDeadlineRules() {
        return ApiResponse.ok(service.listDeadlineRules());
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REGULATION_ADMIN)
    @PostMapping("/deadline-rules")
    public ApiResponse<PekRegulationAdminDtos.DeadlineRuleResponse> createDeadlineRule(
            @RequestBody PekRegulationAdminDtos.CreateDeadlineRuleRequest request) {
        return ApiResponse.ok(service.createDeadlineRule(request, CurrentUser.get().getId()),
                "Правило срока сдачи создано");
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REGULATION_ADMIN)
    @PutMapping("/deadline-rules/{id}")
    public ApiResponse<PekRegulationAdminDtos.DeadlineRuleResponse> updateDeadlineRule(
            @PathVariable Long id, @RequestHeader("If-Match") Long version,
            @RequestBody PekRegulationAdminDtos.UpdateDeadlineRuleRequest request) {
        return ApiResponse.ok(service.updateDeadlineRule(id, version, request, CurrentUser.get().getId()),
                "Правило срока сдачи обновлено");
    }

    /** Item 4. {@code regulationCode} optional - defaults to the currently ACTIVE edition. */
    @PreAuthorize(PekSecurityExpressions.PEK_REGULATION_VIEW)
    @GetMapping("/official-tables")
    public ApiResponse<java.util.List<PekRegulationAdminDtos.OfficialTableConfigResponse>> listOfficialTables(
            @RequestParam(required = false) String regulationCode) {
        return ApiResponse.ok(service.listOfficialTableConfigs(regulationCode));
    }

    @PreAuthorize(PekSecurityExpressions.PEK_REGULATION_ADMIN)
    @PutMapping("/official-tables/{id}")
    public ApiResponse<PekRegulationAdminDtos.OfficialTableConfigResponse> updateOfficialTable(
            @PathVariable Long id, @RequestHeader("If-Match") Long version,
            @RequestBody PekRegulationAdminDtos.UpdateOfficialTableConfigRequest request) {
        return ApiResponse.ok(service.updateOfficialTableConfig(id, version, request, CurrentUser.get().getId()),
                "Настройка официальной таблицы обновлена");
    }

    /** Item 5: single source for the reference lists the admin page (and any other frontend) must
     *  read instead of hardcoding its own copy. */
    @PreAuthorize(PekSecurityExpressions.PEK_REGULATION_VIEW)
    @GetMapping("/reference-catalogs")
    public ApiResponse<PekRegulationAdminDtos.ReferenceCatalogsResponse> referenceCatalogs() {
        return ApiResponse.ok(service.referenceCatalogs());
    }

    /** Item 6: what the backend auto-supplies - the frontend must never ask the user to pick
     *  regulationCode/regulationVersion/templateVersion by hand. */
    @PreAuthorize(PekSecurityExpressions.PEK_REGULATION_VIEW)
    @GetMapping("/defaults")
    public ApiResponse<PekRegulationAdminDtos.RegulationDefaultsResponse> defaults() {
        return ApiResponse.ok(service.defaults());
    }
}
