package kz.eco.company;

import jakarta.validation.Valid;
import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.common.PageResponse;
import kz.eco.company.dto.CompanyDtos;
import kz.eco.user.SecurityExpressions;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;

@RestController
@RequestMapping("/api/companies")
@PreAuthorize(SecurityExpressions.COMPANY_ACCESS)
public class CompanyController {

    private final CompanyService companyService;

    public CompanyController(CompanyService companyService) {
        this.companyService = companyService;
    }

    @GetMapping
    public ApiResponse<PageResponse<CompanyDtos.CompanyListItemDto>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) CompanyStatus status,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort) {
        CompanyStatus effectiveStatus = status != null ? status : CompanyStatus.ACTIVE;
        return ApiResponse.ok(companyService.list(search, effectiveStatus, page, size, sort));
    }

    /** status=ALL bypasses the ACTIVE default explicitly (rather than overloading a null query
     *  param, which Spring can't bind to the CompanyStatus enum). */
    @GetMapping(params = "status=ALL")
    public ApiResponse<PageResponse<CompanyDtos.CompanyListItemDto>> listAllStatuses(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort) {
        return ApiResponse.ok(companyService.list(search, null, page, size, sort));
    }

    @GetMapping("/search")
    public ApiResponse<List<CompanyDtos.CompanySearchDto>> search(@RequestParam String query) {
        return ApiResponse.ok(companyService.search(query));
    }

    @GetMapping("/{id}")
    public ApiResponse<CompanyDtos.CompanyCardDto> get(@PathVariable Long id,
                                                        @RequestParam(defaultValue = "false") boolean includeArchivedObjects) {
        return ApiResponse.ok(companyService.getCard(id, includeArchivedObjects));
    }

    @PostMapping
    @PreAuthorize(SecurityExpressions.COMPANY_EDIT)
    public ApiResponse<CompanyDtos.CompanyDto> create(@Valid @RequestBody CompanyDtos.CreateCompanyRequest request) {
        return ApiResponse.ok(companyService.create(request, CurrentUser.get().getId()), "Компания создана");
    }

    @PatchMapping("/{id}")
    @PreAuthorize(SecurityExpressions.COMPANY_EDIT)
    public ApiResponse<CompanyDtos.CompanyDto> update(@PathVariable Long id,
                                                      @Valid @RequestBody CompanyDtos.UpdateCompanyRequest request) {
        return ApiResponse.ok(companyService.update(id, request, CurrentUser.get().getId()), "Компания обновлена");
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(SecurityExpressions.COMPANY_ARCHIVE)
    public ApiResponse<Void> delete(@PathVariable Long id) {
        String message = companyService.delete(id, CurrentUser.get().getId());
        return ApiResponse.ok(null, message);
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize(SecurityExpressions.COMPANY_ARCHIVE)
    public ApiResponse<CompanyDtos.CompanyDto> archive(@PathVariable Long id) {
        return ApiResponse.ok(companyService.archive(id, CurrentUser.get().getId()), "Компания архивирована");
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize(SecurityExpressions.COMPANY_ARCHIVE)
    public ApiResponse<CompanyDtos.CompanyDto> restore(@PathVariable Long id) {
        return ApiResponse.ok(companyService.restore(id, CurrentUser.get().getId()), "Компания восстановлена");
    }

    @GetMapping("/{companyId}/objects")
    public ApiResponse<List<CompanyDtos.CompanyObjectDto>> listObjects(
            @PathVariable Long companyId,
            @RequestParam(defaultValue = "false") boolean includeArchived) {
        return ApiResponse.ok(companyService.listObjects(companyId, includeArchived));
    }

    @GetMapping("/{companyId}/objects/{objectId}")
    public ApiResponse<CompanyDtos.CompanyObjectDto> getObject(@PathVariable Long companyId,
                                                                @PathVariable Long objectId) {
        return ApiResponse.ok(companyService.getObject(companyId, objectId));
    }

    @PostMapping("/{companyId}/objects")
    @PreAuthorize(SecurityExpressions.COMPANY_EDIT)
    public ApiResponse<CompanyDtos.CompanyObjectDto> createObject(@PathVariable Long companyId,
                                                                  @RequestBody CompanyDtos.CompanyObjectPayload request) {
        return ApiResponse.ok(companyService.createObject(companyId, request, CurrentUser.get().getId()), "Объект создан");
    }

    @PatchMapping("/{companyId}/objects/{objectId}")
    @PreAuthorize(SecurityExpressions.COMPANY_EDIT)
    public ApiResponse<CompanyDtos.CompanyObjectDto> updateObject(@PathVariable Long companyId,
                                                                @PathVariable Long objectId,
                                                                @RequestBody CompanyDtos.CompanyObjectPayload request) {
        return ApiResponse.ok(companyService.updateObject(companyId, objectId, request, CurrentUser.get().getId()), "Объект обновлён");
    }

    /** Non-destructive: soft-archives the object. Spec explicitly requires this not be a DELETE. */
    @PostMapping("/{companyId}/objects/{objectId}/archive")
    @PreAuthorize(SecurityExpressions.COMPANY_ARCHIVE)
    public ApiResponse<CompanyDtos.CompanyObjectDto> archiveObject(@PathVariable Long companyId,
                                                                 @PathVariable Long objectId) {
        return ApiResponse.ok(companyService.archiveObject(companyId, objectId, CurrentUser.get().getId()), "Объект архивирован");
    }

    @PostMapping("/{companyId}/objects/{objectId}/restore")
    @PreAuthorize(SecurityExpressions.COMPANY_ARCHIVE)
    public ApiResponse<CompanyDtos.CompanyObjectDto> restoreObject(@PathVariable Long companyId,
                                                                    @PathVariable Long objectId) {
        return ApiResponse.ok(companyService.restoreObject(companyId, objectId, CurrentUser.get().getId()), "Объект восстановлен");
    }
}
