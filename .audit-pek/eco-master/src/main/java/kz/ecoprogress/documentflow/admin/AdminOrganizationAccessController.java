package kz.ecoprogress.documentflow.admin;

import kz.eco.common.ApiResponse;
import kz.eco.common.PageResponse;
import kz.ecoprogress.documentflow.admin.dto.AdminOrganizationAccessDto;
import kz.ecoprogress.documentflow.admin.dto.OrganizationDocumentFlowAccessAdminDto;
import kz.ecoprogress.documentflow.subscription.SubscriptionStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

import static kz.ecoprogress.documentflow.admin.DocumentFlowAdminSecurityExpressions.DOCUMENT_FLOW_ACCESS_VIEW;

/**
 * GET /api/admin/document-flow/access[/{organizationId}] - the paginated org-access list (task
 * item 1/11) and the per-organization detail card (task item 4/12). Deliberately a separate
 * controller from {@link AdminSubscriptionController} (which is keyed by
 * "/subscriptions/{organizationId}/**") since this one's base path is "/access", matching the
 * user-facing "/api/document-flow/access" naming convention on the admin side.
 */
@RestController
@RequestMapping("/api/admin/document-flow/access")
public class AdminOrganizationAccessController {

    private final AdminOrganizationAccessQueryService queryService;
    private final AdminSubscriptionService subscriptionService;

    public AdminOrganizationAccessController(AdminOrganizationAccessQueryService queryService,
                                               AdminSubscriptionService subscriptionService) {
        this.queryService = queryService;
        this.subscriptionService = subscriptionService;
    }

    @GetMapping
    @PreAuthorize(DOCUMENT_FLOW_ACCESS_VIEW)
    public ApiResponse<PageResponse<OrganizationDocumentFlowAccessAdminDto>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) SubscriptionStatus status,
            @RequestParam(required = false) String planCode,
            /** Alias for {@code status}; "NONE" means hasSubscription=false. Accepted alongside
             *  {@code status}/{@code hasSubscription} for UI convenience - if both are supplied,
             *  {@code status}/{@code hasSubscription} win (accessState is applied first, then
             *  overridden). */
            @RequestParam(required = false) String accessState,
            @RequestParam(required = false) Boolean hasSubscription,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime expiresBefore,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime expiresAfter,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "organizationName") String sort,
            @RequestParam(defaultValue = "asc") String direction) {

        SubscriptionStatus effectiveStatus = status;
        Boolean effectiveHasSubscription = hasSubscription;
        if (accessState != null && !accessState.isBlank()) {
            if ("NONE".equalsIgnoreCase(accessState)) {
                if (effectiveHasSubscription == null) effectiveHasSubscription = false;
            } else if (effectiveStatus == null) {
                effectiveStatus = SubscriptionStatus.valueOf(accessState.toUpperCase());
            }
        }

        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.max(size, 1),
                Sort.by("desc".equalsIgnoreCase(direction) ? Sort.Direction.DESC : Sort.Direction.ASC, sort));

        AdminOrganizationAccessQueryService.Filter filter = new AdminOrganizationAccessQueryService.Filter(
                (search == null || search.isBlank()) ? null : search.trim(),
                effectiveStatus, planCode, effectiveHasSubscription, expiresBefore, expiresAfter);

        return ApiResponse.ok(queryService.list(filter, pageable));
    }

    @GetMapping("/{organizationId}")
    @PreAuthorize(DOCUMENT_FLOW_ACCESS_VIEW)
    public ApiResponse<AdminOrganizationAccessDto> detail(@PathVariable Long organizationId) {
        return ApiResponse.ok(subscriptionService.getOrganizationAccessDetail(organizationId));
    }
}
