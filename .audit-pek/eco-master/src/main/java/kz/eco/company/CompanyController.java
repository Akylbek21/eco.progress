package kz.eco.company;

import jakarta.validation.Valid;
import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.common.PageResponse;
import kz.eco.company.dto.CompanyDtos;
import kz.eco.user.SecurityExpressions;
import kz.eco.user.User;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;

@RestController
@RequestMapping("/api/companies")
@PreAuthorize(SecurityExpressions.COMPANY_ACCESS)
public class CompanyController {

    private final CompanyService companyService;
    private final CompanyMembershipService membershipService;

    public CompanyController(CompanyService companyService, CompanyMembershipService membershipService) {
        this.companyService = companyService;
        this.membershipService = membershipService;
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
    @PreAuthorize(SecurityExpressions.COMPANY_CREATE)
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
    public ApiResponse<Void> delete(@PathVariable Long id, @RequestParam("version") Long version) {
        String message = companyService.delete(id, version, CurrentUser.get().getId());
        return ApiResponse.ok(null, message);
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize(SecurityExpressions.COMPANY_ARCHIVE)
    public ApiResponse<CompanyDtos.CompanyDto> archive(@PathVariable Long id, @RequestParam("version") Long version) {
        return ApiResponse.ok(companyService.archive(id, version, CurrentUser.get().getId()), "Компания архивирована");
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize(SecurityExpressions.COMPANY_ARCHIVE)
    public ApiResponse<CompanyDtos.CompanyDto> restore(@PathVariable Long id, @RequestParam("version") Long version) {
        return ApiResponse.ok(companyService.restore(id, version, CurrentUser.get().getId()), "Компания восстановлена");
    }

    /** Frontend sends {@code includeArchivedObjects} (src/services/companyService.ts) - accept the
     *  older {@code includeArchived} name too so any existing caller keeps working. */
    @GetMapping("/{companyId}/objects")
    public ApiResponse<List<CompanyDtos.CompanyObjectDto>> listObjects(
            @PathVariable Long companyId,
            @RequestParam(defaultValue = "false") boolean includeArchivedObjects,
            @RequestParam(defaultValue = "false") boolean includeArchived) {
        return ApiResponse.ok(companyService.listObjects(companyId, includeArchivedObjects || includeArchived));
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

    /** Version is passed via the standard If-Match header (value from GET $.data.version), not in
     *  the request body - this way the frontend never has to manually wire a version field into the
     *  PATCH form. Missing header → 400 VERSION_REQUIRED; stale → 409 VERSION_CONFLICT. */
    @PatchMapping("/{companyId}/objects/{objectId}")
    @PreAuthorize(SecurityExpressions.COMPANY_EDIT)
    public ApiResponse<CompanyDtos.CompanyObjectDto> updateObject(@PathVariable Long companyId,
                                                                @PathVariable Long objectId,
                                                                @RequestHeader(value = "If-Match", required = false) Long ifMatch,
                                                                @RequestBody CompanyDtos.CompanyObjectPayload request) {
        return ApiResponse.ok(companyService.updateObject(companyId, objectId, request, ifMatch, CurrentUser.get().getId()), "Объект обновлён");
    }

    /** Non-destructive: soft-archives the object. Spec explicitly requires this not be a DELETE. */
    @PostMapping("/{companyId}/objects/{objectId}/archive")
    @PreAuthorize(SecurityExpressions.COMPANY_ARCHIVE)
    public ApiResponse<CompanyDtos.CompanyObjectDto> archiveObject(@PathVariable Long companyId,
                                                                 @PathVariable Long objectId,
                                                                 @RequestParam("version") Long version) {
        return ApiResponse.ok(companyService.archiveObject(companyId, objectId, version, CurrentUser.get().getId()), "Объект архивирован");
    }

    @PostMapping("/{companyId}/objects/{objectId}/restore")
    @PreAuthorize(SecurityExpressions.COMPANY_ARCHIVE)
    public ApiResponse<CompanyDtos.CompanyObjectDto> restoreObject(@PathVariable Long companyId,
                                                                    @PathVariable Long objectId,
                                                                    @RequestParam("version") Long version) {
        return ApiResponse.ok(companyService.restoreObject(companyId, objectId, version, CurrentUser.get().getId()), "Объект восстановлен");
    }

    // ---------------------------------------------------------------- membership

    /** P0 module fix item 5: GET is now gated by the same COMPANY_ACCESS (view-tier) permission as
     *  the company detail/objects endpoints, not COMPANY_EDIT - a viewer (e.g. LABORATORY) can open
     *  the members tab without needing edit rights. Mutations below remain COMPANY_EDIT-gated. */
    @GetMapping("/{companyId}/members")
    @PreAuthorize(SecurityExpressions.COMPANY_ACCESS)
    public ApiResponse<List<CompanyDtos.CompanyMembershipDto>> listMembers(@PathVariable Long companyId) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(membershipService.list(companyId, actor.getId(), actor.getRole()));
    }

    @PostMapping("/{companyId}/members")
    @PreAuthorize(SecurityExpressions.COMPANY_EDIT)
    public ApiResponse<CompanyDtos.CompanyMembershipDto> addMember(
            @PathVariable Long companyId, @RequestBody CompanyDtos.AddCompanyMembershipRequest request) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(membershipService.add(companyId, request, actor.getId(), actor.getRole()), "Сотрудник добавлен");
    }

    @PatchMapping("/{companyId}/members/{membershipId}")
    @PreAuthorize(SecurityExpressions.COMPANY_EDIT)
    public ApiResponse<CompanyDtos.CompanyMembershipDto> updateMember(
            @PathVariable Long companyId, @PathVariable Long membershipId,
            @RequestBody CompanyDtos.UpdateCompanyMembershipRequest request) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(
                membershipService.updateRoleOrStatus(companyId, membershipId, request, actor.getId(), actor.getRole()),
                "Данные сотрудника обновлены");
    }

    @DeleteMapping("/{companyId}/members/{membershipId}")
    @PreAuthorize(SecurityExpressions.COMPANY_EDIT)
    public ApiResponse<Void> removeMember(@PathVariable Long companyId, @PathVariable Long membershipId,
                                           @RequestParam("version") Long version) {
        User actor = CurrentUser.get();
        membershipService.remove(companyId, membershipId, version, actor.getId(), actor.getRole());
        return ApiResponse.ok(null, "Доступ отозван");
    }
}
