package kz.eco.services;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.news.dto.NewsReasonRequest;
import kz.eco.news.dto.NewsVersionRequest;
import kz.eco.services.dto.EcoServiceResponse;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** CMS review workflow for the eco_services catalogue - unified kz.eco.content.ContentStatus:
 *  DRAFT -&gt; IN_REVIEW -&gt; APPROVED -&gt; PUBLISHED -&gt; ARCHIVED. Editorial gate only - ADMIN/DIRECTOR.
 *  Every mutation is version-checked - a stale version returns 409 VERSION_CONFLICT. */
@RestController
@RequestMapping("/api/admin/content/services")
@PreAuthorize(SecurityExpressions.SERVICE_CONTENT_REVIEW)
public class EcoServiceReviewController {

    private final EcoServiceService service;

    public EcoServiceReviewController(EcoServiceService service) {
        this.service = service;
    }

    @PostMapping("/{id}/submit-review")
    public ApiResponse<EcoServiceResponse> submitForReview(@PathVariable String id, @RequestBody NewsVersionRequest request) {
        return ApiResponse.ok(service.submitForReview(id, request.version(), CurrentUser.get()), "Услуга отправлена на проверку");
    }

    @PostMapping("/{id}/return-for-revision")
    public ApiResponse<EcoServiceResponse> returnForRevision(@PathVariable String id, @RequestBody NewsReasonRequest request) {
        return ApiResponse.ok(service.returnForRevision(id, request.version(), request.reason(), CurrentUser.get()), "Услуга возвращена на доработку");
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<EcoServiceResponse> approve(@PathVariable String id, @RequestBody NewsVersionRequest request) {
        return ApiResponse.ok(service.approve(id, request.version(), CurrentUser.get()), "Услуга утверждена");
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<EcoServiceResponse> publish(@PathVariable String id, @RequestBody NewsVersionRequest request) {
        return ApiResponse.ok(service.publish(id, request.version(), CurrentUser.get()), "Услуга опубликована");
    }

    @PostMapping("/{id}/archive")
    public ApiResponse<EcoServiceResponse> archive(@PathVariable String id, @RequestBody NewsVersionRequest request) {
        return ApiResponse.ok(service.archive(id, request.version(), CurrentUser.get()), "Услуга архивирована");
    }

    @PostMapping("/{id}/revoke-approval")
    public ApiResponse<EcoServiceResponse> revokeApproval(@PathVariable String id, @RequestBody NewsReasonRequest request) {
        return ApiResponse.ok(service.revokeApproval(id, request.version(), request.reason(), CurrentUser.get()), "Утверждение снято");
    }
}
