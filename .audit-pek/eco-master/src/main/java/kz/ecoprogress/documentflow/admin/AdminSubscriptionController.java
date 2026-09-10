package kz.ecoprogress.documentflow.admin;

import jakarta.validation.Valid;
import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.user.User;
import kz.ecoprogress.documentflow.admin.dto.*;
import kz.ecoprogress.documentflow.infrastructure.DocumentFlowIdempotencyService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.function.Supplier;

import static kz.ecoprogress.documentflow.admin.DocumentFlowAdminSecurityExpressions.*;

@RestController
@RequestMapping("/api/admin/document-flow/subscriptions")
public class AdminSubscriptionController {

    private static final String SCOPE_EXTEND = "document-flow-extend";
    private static final String SCOPE_SUSPEND = "document-flow-suspend";
    private static final String SCOPE_RESTORE = "document-flow-restore";
    private static final String SCOPE_REVOKE = "document-flow-revoke";
    private static final String SCOPE_CHANGE_PLAN = "document-flow-change-plan";

    private final AdminSubscriptionService service;
    private final DocumentFlowIdempotencyService idempotencyService;

    public AdminSubscriptionController(AdminSubscriptionService service, DocumentFlowIdempotencyService idempotencyService) {
        this.service = service;
        this.idempotencyService = idempotencyService;
    }

    @GetMapping
    @PreAuthorize(DOCUMENT_FLOW_ACCESS_VIEW)
    public ApiResponse<List<SubscriptionAdminDto>> list() {
        return ApiResponse.ok(service.listAll().stream().map(SubscriptionAdminDto::from).toList());
    }

    @GetMapping("/{organizationId}")
    @PreAuthorize(DOCUMENT_FLOW_ACCESS_VIEW)
    public ApiResponse<SubscriptionAdminDto> get(@PathVariable Long organizationId) {
        return ApiResponse.ok(SubscriptionAdminDto.from(service.getByOrganization(organizationId)));
    }

    @GetMapping("/{organizationId}/events")
    @PreAuthorize(DOCUMENT_FLOW_ACCESS_VIEW)
    public ApiResponse<kz.eco.common.PageResponse<SubscriptionEventAdminDto>> events(
            @PathVariable Long organizationId,
            @RequestParam(required = false) kz.ecoprogress.documentflow.subscription.SubscriptionEventType eventType,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime from,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(
                Math.max(page, 0), Math.max(size, 1),
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt"));
        return ApiResponse.ok(service.listEvents(organizationId, eventType, from, to, pageable));
    }

    @PostMapping("/{organizationId}/extend")
    @PreAuthorize(DOCUMENT_FLOW_ACCESS_MANAGE)
    public ApiResponse<AdminOrganizationAccessDto> extend(@PathVariable Long organizationId, @Valid @RequestBody ExtendRequest request,
                                                            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        User actor = CurrentUser.get();
        return withIdempotency(SCOPE_EXTEND, idempotencyKey, request, organizationId,
                () -> service.extend(organizationId, request.newExpiresAt(), request.reason(), actor, request.expectedVersion()),
                "Подписка продлена");
    }

    @PostMapping("/{organizationId}/suspend")
    @PreAuthorize(DOCUMENT_FLOW_ACCESS_MANAGE)
    public ApiResponse<AdminOrganizationAccessDto> suspend(@PathVariable Long organizationId, @Valid @RequestBody ReasonRequest request,
                                                             @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        User actor = CurrentUser.get();
        return withIdempotency(SCOPE_SUSPEND, idempotencyKey, request, organizationId,
                () -> service.suspend(organizationId, request.reason(), actor, request.expectedVersion()),
                "Доступ приостановлен");
    }

    @PostMapping("/{organizationId}/restore")
    @PreAuthorize(DOCUMENT_FLOW_ACCESS_MANAGE)
    public ApiResponse<AdminOrganizationAccessDto> restore(@PathVariable Long organizationId, @Valid @RequestBody ReasonRequest request,
                                                             @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        User actor = CurrentUser.get();
        return withIdempotency(SCOPE_RESTORE, idempotencyKey, request, organizationId,
                () -> service.restore(organizationId, request.reason(), actor, request.expectedVersion()),
                "Доступ восстановлен");
    }

    @PostMapping("/{organizationId}/revoke")
    @PreAuthorize(DOCUMENT_FLOW_ACCESS_MANAGE)
    public ApiResponse<AdminOrganizationAccessDto> revoke(@PathVariable Long organizationId, @Valid @RequestBody ReasonRequest request,
                                                            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        User actor = CurrentUser.get();
        return withIdempotency(SCOPE_REVOKE, idempotencyKey, request, organizationId,
                () -> service.revoke(organizationId, request.reason(), actor, request.expectedVersion()),
                "Доступ отозван");
    }

    @PostMapping("/{organizationId}/change-plan")
    @PreAuthorize(DOCUMENT_FLOW_PLAN_MANAGE)
    public ApiResponse<AdminOrganizationAccessDto> changePlan(@PathVariable Long organizationId, @Valid @RequestBody ChangePlanRequest request,
                                                                @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        User actor = CurrentUser.get();
        return withIdempotency(SCOPE_CHANGE_PLAN, idempotencyKey, request, organizationId,
                () -> service.changePlan(organizationId, request.planCode(), request.reason(), actor, request.expectedVersion()),
                "Тарифный план изменён");
    }

    @PostMapping("/{organizationId}/limits")
    @PreAuthorize(DOCUMENT_FLOW_PLAN_MANAGE)
    public ApiResponse<AdminOrganizationAccessDto> updateLimits(@PathVariable Long organizationId, @Valid @RequestBody LimitsRequest request) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(service.updateLimits(organizationId, request.limits(), request.startsAt(), request.expiresAt(), request.reason(), actor, request.expectedVersion()), "Лимиты обновлены");
    }

    @PostMapping("/{organizationId}/entitlements")
    @PreAuthorize(DOCUMENT_FLOW_PLAN_MANAGE)
    public ApiResponse<AdminOrganizationAccessDto> updateEntitlements(@PathVariable Long organizationId, @Valid @RequestBody EntitlementsRequest request) {
        User actor = CurrentUser.get();
        return ApiResponse.ok(service.updateEntitlements(organizationId, request, actor), "Функции обновлены");
    }

    /** Shared Idempotency-Key plumbing for extend/suspend/restore/revoke/change-plan - same
     *  begin/complete/fail pattern as {@link AdminAccessGrantController}, scoped per action so a
     *  retried "suspend" click can't be confused with a retried "extend" click even if a client
     *  reused the same key string. On replay (same key + same request body) returns a freshly
     *  recomputed {@link AdminOrganizationAccessDto} for the organization rather than a stored
     *  snapshot, since the DTO is cheap to rebuild and always reflects current membership/usage
     *  even if it hasn't changed since the original call. */
    private ApiResponse<AdminOrganizationAccessDto> withIdempotency(String scope, String idempotencyKey, Object request,
                                                                      Long organizationId, Supplier<AdminOrganizationAccessDto> action,
                                                                      String successMessage) {
        DocumentFlowIdempotencyService.IdempotencyOutcome outcome = idempotencyService.begin(scope, idempotencyKey, request);
        if (outcome instanceof DocumentFlowIdempotencyService.ReturnExisting) {
            return ApiResponse.ok(service.getAccessContextForOrganization(organizationId), successMessage + " (idempotent replay)");
        }
        Long recordId = ((DocumentFlowIdempotencyService.Proceed) outcome).recordId();
        try {
            AdminOrganizationAccessDto dto = action.get();
            idempotencyService.complete(recordId, organizationId);
            return ApiResponse.ok(dto, successMessage);
        } catch (RuntimeException e) {
            idempotencyService.fail(recordId);
            throw e;
        }
    }
}
