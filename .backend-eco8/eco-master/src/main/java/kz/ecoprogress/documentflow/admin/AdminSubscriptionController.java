package kz.ecoprogress.documentflow.admin;

import jakarta.validation.Valid;
import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.user.User;
import kz.ecoprogress.documentflow.access.AccessContext;
import kz.ecoprogress.documentflow.admin.dto.*;
import kz.ecoprogress.documentflow.api.dto.AccessContextDto;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/document-flow/subscriptions")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSubscriptionController {

    private final AdminSubscriptionService service;

    public AdminSubscriptionController(AdminSubscriptionService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<SubscriptionAdminDto>> list() {
        return ApiResponse.ok(service.listAll().stream().map(SubscriptionAdminDto::from).toList());
    }

    @GetMapping("/{organizationId}")
    public ApiResponse<SubscriptionAdminDto> get(@PathVariable Long organizationId) {
        return ApiResponse.ok(SubscriptionAdminDto.from(service.getByOrganization(organizationId)));
    }

    @PostMapping("/{organizationId}/extend")
    public ApiResponse<AccessContextDto> extend(@PathVariable Long organizationId, @Valid @RequestBody ExtendRequest request) {
        User actor = CurrentUser.get();
        AccessContext context = service.extend(organizationId, request.newExpiresAt(), request.reason(), actor);
        return ApiResponse.ok(AccessContextDto.from(context), "Подписка продлена");
    }

    @PostMapping("/{organizationId}/suspend")
    public ApiResponse<AccessContextDto> suspend(@PathVariable Long organizationId, @Valid @RequestBody ReasonRequest request) {
        User actor = CurrentUser.get();
        AccessContext context = service.suspend(organizationId, request.reason(), actor);
        return ApiResponse.ok(AccessContextDto.from(context), "Доступ приостановлен");
    }

    @PostMapping("/{organizationId}/restore")
    public ApiResponse<AccessContextDto> restore(@PathVariable Long organizationId, @Valid @RequestBody ReasonRequest request) {
        User actor = CurrentUser.get();
        AccessContext context = service.restore(organizationId, request.reason(), actor);
        return ApiResponse.ok(AccessContextDto.from(context), "Доступ восстановлен");
    }

    @PostMapping("/{organizationId}/revoke")
    public ApiResponse<AccessContextDto> revoke(@PathVariable Long organizationId, @Valid @RequestBody ReasonRequest request) {
        User actor = CurrentUser.get();
        AccessContext context = service.revoke(organizationId, request.reason(), actor);
        return ApiResponse.ok(AccessContextDto.from(context), "Доступ отозван");
    }

    @PostMapping("/{organizationId}/change-plan")
    public ApiResponse<AccessContextDto> changePlan(@PathVariable Long organizationId, @Valid @RequestBody ChangePlanRequest request) {
        User actor = CurrentUser.get();
        AccessContext context = service.changePlan(organizationId, request.planCode(), request.reason(), actor);
        return ApiResponse.ok(AccessContextDto.from(context), "Тарифный план изменён");
    }

    @PostMapping("/{organizationId}/limits")
    public ApiResponse<AccessContextDto> updateLimits(@PathVariable Long organizationId, @Valid @RequestBody LimitsRequest request) {
        User actor = CurrentUser.get();
        AccessContext context = service.updateLimits(organizationId, request.limits(), request.startsAt(), request.expiresAt(), request.reason(), actor);
        return ApiResponse.ok(AccessContextDto.from(context), "Лимиты обновлены");
    }

    @PostMapping("/{organizationId}/entitlements")
    public ApiResponse<AccessContextDto> updateEntitlements(@PathVariable Long organizationId, @Valid @RequestBody EntitlementsRequest request) {
        User actor = CurrentUser.get();
        AccessContext context = service.updateEntitlements(organizationId, request, actor);
        return ApiResponse.ok(AccessContextDto.from(context), "Функции обновлены");
    }
}
