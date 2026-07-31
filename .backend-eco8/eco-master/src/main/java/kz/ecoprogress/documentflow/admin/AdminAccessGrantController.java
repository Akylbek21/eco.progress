package kz.ecoprogress.documentflow.admin;

import jakarta.validation.Valid;
import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.user.User;
import kz.ecoprogress.documentflow.access.AccessContext;
import kz.ecoprogress.documentflow.admin.dto.AccessGrantRequest;
import kz.ecoprogress.documentflow.api.dto.AccessContextDto;
import kz.ecoprogress.documentflow.infrastructure.DocumentFlowIdempotencyService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * POST /api/admin/document-flow/access-grants - supports an {@code Idempotency-Key} header via
 * {@link DocumentFlowIdempotencyService} so a retried admin click (or a flaky network response)
 * doesn't grant/overwrite the same organization's subscription twice.
 */
@RestController
@RequestMapping("/api/admin/document-flow/access-grants")
@PreAuthorize("hasRole('ADMIN')")
public class AdminAccessGrantController {

    private static final String SCOPE = "document-flow-access-grant";

    private final AdminSubscriptionService service;
    private final DocumentFlowIdempotencyService idempotencyService;

    public AdminAccessGrantController(AdminSubscriptionService service, DocumentFlowIdempotencyService idempotencyService) {
        this.service = service;
        this.idempotencyService = idempotencyService;
    }

    @PostMapping
    public ApiResponse<AccessContextDto> grant(@Valid @RequestBody AccessGrantRequest request,
                                                @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        User actor = CurrentUser.get();

        DocumentFlowIdempotencyService.IdempotencyOutcome outcome = idempotencyService.begin(SCOPE, idempotencyKey, request);
        if (outcome instanceof DocumentFlowIdempotencyService.ReturnExisting) {
            AccessContext context = service.getAccessContextForOrganization(request.organizationId());
            return ApiResponse.ok(AccessContextDto.from(context), "Доступ уже был предоставлен ранее (idempotent replay)");
        }
        Long recordId = ((DocumentFlowIdempotencyService.Proceed) outcome).recordId();

        try {
            AccessContext context = service.grantAccess(request, actor);
            idempotencyService.complete(recordId, request.organizationId());
            return ApiResponse.ok(AccessContextDto.from(context), "Доступ предоставлен");
        } catch (RuntimeException e) {
            idempotencyService.fail(recordId);
            throw e;
        }
    }
}
