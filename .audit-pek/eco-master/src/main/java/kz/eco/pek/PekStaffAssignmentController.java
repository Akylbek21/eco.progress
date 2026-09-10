package kz.eco.pek;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.pek.dto.PekStaffAssignmentDtos;
import kz.eco.user.User;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** CRUD for {@code pek_staff_assignments} - assigns OUR staff to a client company's PEK data with
 *  an explicit {@link PekStaffTier} (see {@link PekStaffAssignment}). This is now the primary
 *  mechanism {@link PekAccessService} reads for company scope/permissions - replaces
 *  {@link PekCompanyMembershipController} in that role (that controller/table are left in place,
 *  unused by any access-control path, purely for historical-data compatibility). */
@RestController
@RequestMapping("/api/pek/companies/{companyId}/staff")
@PreAuthorize(PekSecurityExpressions.PEK_SETTINGS_EDIT)
public class PekStaffAssignmentController {

    private final PekStaffAssignmentService service;

    public PekStaffAssignmentController(PekStaffAssignmentService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<PekStaffAssignmentDtos.PekStaffAssignmentDto>> list(@PathVariable Long companyId) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(service.list(companyId, actor.getId(), actor.getRole()));
    }

    @PostMapping
    public ApiResponse<PekStaffAssignmentDtos.PekStaffAssignmentDto> assign(
            @PathVariable Long companyId, @RequestBody PekStaffAssignmentDtos.AssignPekStaffRequest request) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(service.assign(companyId, request, actor.getId(), actor.getRole()), "Сотрудник назначен на компанию");
    }

    @PatchMapping("/{assignmentId}")
    public ApiResponse<PekStaffAssignmentDtos.PekStaffAssignmentDto> update(
            @PathVariable Long companyId, @PathVariable Long assignmentId,
            @RequestBody PekStaffAssignmentDtos.UpdatePekStaffAssignmentRequest request,
            @RequestHeader("If-Match") Long version) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(service.update(companyId, assignmentId, request, version, actor.getId(), actor.getRole()), "Назначение обновлено");
    }

    @DeleteMapping("/{assignmentId}")
    public ApiResponse<Void> remove(@PathVariable Long companyId, @PathVariable Long assignmentId,
                                     @RequestHeader("If-Match") Long version) {
        User actor = CurrentUser.get();
        service.remove(companyId, assignmentId, version, actor.getId(), actor.getRole());
        return ApiResponse.ok(null, "Назначение снято");
    }
}
