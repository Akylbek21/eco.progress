package kz.eco.laboratory;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.laboratory.dto.LaboratoryDtos;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/laboratories")
@PreAuthorize(SecurityExpressions.LAB_SETTINGS_READ)
public class LaboratoryController {

    private final LaboratoryService laboratoryService;

    public LaboratoryController(LaboratoryService laboratoryService) {
        this.laboratoryService = laboratoryService;
    }

    @GetMapping
    public ApiResponse<List<LaboratoryDtos.LaboratoryResponse>> list(
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        return ApiResponse.ok(laboratoryService.list(includeInactive));
    }

    @GetMapping("/eligible-employees")
    @PreAuthorize(SecurityExpressions.LAB_SETTINGS_WRITE)
    public ApiResponse<List<LaboratoryDtos.EligibleEmployeeResponse>> eligibleEmployees() {
        return ApiResponse.ok(laboratoryService.eligibleEmployees());
    }

    @GetMapping("/{id:\\d+}")
    public ApiResponse<LaboratoryDtos.LaboratoryResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(laboratoryService.get(id));
    }

    @GetMapping("/{id:\\d+}/employees")
    public ApiResponse<List<LaboratoryDtos.LaboratoryEmployeeResponse>> listEmployees(
            @PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        return ApiResponse.ok(laboratoryService.listEmployees(id, includeInactive));
    }

    @PostMapping
    @PreAuthorize(SecurityExpressions.LAB_CREATE)
    public ApiResponse<LaboratoryDtos.LaboratoryResponse> create(
            @RequestBody LaboratoryDtos.CreateLaboratoryRequest request) {
        return ApiResponse.ok(laboratoryService.create(request), "Лаборатория создана");
    }

    @PatchMapping("/{id:\\d+}")
    @PreAuthorize(SecurityExpressions.LAB_SETTINGS_WRITE)
    public ApiResponse<LaboratoryDtos.LaboratoryResponse> update(
            @PathVariable Long id,
            @RequestBody LaboratoryDtos.UpdateLaboratoryRequest request) {
        return ApiResponse.ok(laboratoryService.update(id, request, CurrentUser.get()), "Лаборатория обновлена");
    }

    @PostMapping("/{id:\\d+}/employees")
    @PreAuthorize(SecurityExpressions.LAB_SETTINGS_WRITE)
    public ApiResponse<LaboratoryDtos.LaboratoryEmployeeResponse> createEmployee(
            @PathVariable Long id,
            @RequestBody LaboratoryDtos.CreateEmployeeRequest request) {
        return ApiResponse.ok(laboratoryService.createEmployee(id, request, CurrentUser.get()), "Сотрудник добавлен");
    }

    @PatchMapping("/{id:\\d+}/employees/{employeeId:\\d+}")
    @PreAuthorize(SecurityExpressions.LAB_SETTINGS_WRITE)
    public ApiResponse<LaboratoryDtos.LaboratoryEmployeeResponse> updateEmployee(
            @PathVariable Long id,
            @PathVariable Long employeeId,
            @RequestBody LaboratoryDtos.UpdateEmployeeRequest request) {
        return ApiResponse.ok(laboratoryService.updateEmployee(id, employeeId, request, CurrentUser.get()), "Сотрудник обновлён");
    }

    @DeleteMapping("/{id:\\d+}/employees/{employeeId:\\d+}")
    @PreAuthorize(SecurityExpressions.LAB_SETTINGS_WRITE)
    public ApiResponse<LaboratoryDtos.LaboratoryEmployeeResponse> archiveEmployee(
            @PathVariable Long id,
            @PathVariable Long employeeId) {
        return ApiResponse.ok(laboratoryService.archiveEmployee(id, employeeId), "Сотрудник архивирован");
    }
}
