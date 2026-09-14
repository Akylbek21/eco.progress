package kz.eco.pek;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.pek.dto.PekMembershipDtos;
import kz.eco.user.User;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * CRUD for {@code pek_company_memberships} (module spec item 2) - lets an admin staff a PEK
 * company immediately after it's created/connected, without a manual DB seed (previously the only
 * way any row got into this table was direct repository access from test setup code). Own
 * controller, same precedent as {@link PekPermitController}/{@link PekReportDocumentController} -
 * a distinct sub-resource controller rather than folding into the already-large
 * {@link PekController}.
 */
@RestController
@RequestMapping("/api/pek/companies/{companyId}/members")
@PreAuthorize(PekSecurityExpressions.PEK_SETTINGS_EDIT)
public class PekCompanyMembershipController {

    private final PekCompanyMembershipService membershipService;

    public PekCompanyMembershipController(PekCompanyMembershipService membershipService) {
        this.membershipService = membershipService;
    }

    @GetMapping
    public ApiResponse<List<PekMembershipDtos.PekCompanyMembershipDto>> list(@PathVariable Long companyId) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(membershipService.list(companyId, actor.getId(), actor.getRole()));
    }

    @PostMapping
    public ApiResponse<PekMembershipDtos.PekCompanyMembershipDto> add(
            @PathVariable Long companyId, @RequestBody PekMembershipDtos.AddPekMembershipRequest request) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(membershipService.add(companyId, request, actor.getId(), actor.getRole()), "Сотрудник добавлен");
    }

    @PatchMapping("/{membershipId}")
    public ApiResponse<PekMembershipDtos.PekCompanyMembershipDto> update(
            @PathVariable Long companyId, @PathVariable Long membershipId,
            @RequestBody PekMembershipDtos.UpdatePekMembershipRequest request) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(
                membershipService.updateRoleOrStatus(companyId, membershipId, request, actor.getId(), actor.getRole()),
                "Данные сотрудника обновлены");
    }

    @DeleteMapping("/{membershipId}")
    public ApiResponse<Void> remove(@PathVariable Long companyId, @PathVariable Long membershipId) {
        User actor = CurrentUser.get();
        membershipService.remove(companyId, membershipId, actor.getId(), actor.getRole());
        return ApiResponse.ok(null, "Доступ отозван");
    }
}
