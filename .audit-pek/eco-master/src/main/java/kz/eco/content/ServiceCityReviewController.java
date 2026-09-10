package kz.eco.content;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.content.dto.ServiceCityPageResponse;
import kz.eco.content.dto.ServiceCityReasonRequest;
import kz.eco.content.dto.ServiceCityVersionRequest;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** SEO-review workflow for service-city pages - unified kz.eco.content.ContentStatus: DRAFT -&gt;
 *  IN_REVIEW -&gt; APPROVED -&gt; PUBLISHED -&gt; ARCHIVED (see ServiceCityPage#isIndexable()). Editorial
 *  gate only - ADMIN/DIRECTOR, same tier as SecurityExpressions.NEWS_REVIEW. Every mutation is
 *  version-checked - a stale version returns 409 VERSION_CONFLICT. */
@RestController
@RequestMapping("/api/admin/content/regions")
@PreAuthorize(SecurityExpressions.CITY_CONTENT_REVIEW)
public class ServiceCityReviewController {

    private final ServiceCityPageService service;

    public ServiceCityReviewController(ServiceCityPageService service) {
        this.service = service;
    }

    @PostMapping("/{serviceId}/{citySlug}/check-quality")
    public ApiResponse<ServiceCityPageResponse> checkQuality(@PathVariable String serviceId, @PathVariable String citySlug) {
        return ApiResponse.ok(service.checkQuality(serviceId, citySlug), "Проверка качества выполнена");
    }

    @PostMapping("/{serviceId}/{citySlug}/submit-review")
    public ApiResponse<ServiceCityPageResponse> submitForReview(@PathVariable String serviceId, @PathVariable String citySlug,
                                                                  @RequestBody ServiceCityVersionRequest request) {
        return ApiResponse.ok(service.submitForReview(serviceId, citySlug, request.version(), CurrentUser.get()), "Страница отправлена на проверку");
    }

    @PostMapping("/{serviceId}/{citySlug}/return-for-revision")
    public ApiResponse<ServiceCityPageResponse> returnForRevision(@PathVariable String serviceId, @PathVariable String citySlug,
                                                                    @RequestBody ServiceCityReasonRequest request) {
        return ApiResponse.ok(service.returnForRevision(serviceId, citySlug, request.version(), request.reason(), CurrentUser.get()),
                "Страница возвращена на доработку");
    }

    @PostMapping("/{serviceId}/{citySlug}/approve")
    public ApiResponse<ServiceCityPageResponse> approve(@PathVariable String serviceId, @PathVariable String citySlug,
                                                          @RequestBody ServiceCityVersionRequest request) {
        return ApiResponse.ok(service.approve(serviceId, citySlug, request.version(), CurrentUser.get()), "Региональный контент утверждён");
    }

    @PostMapping("/{serviceId}/{citySlug}/publish")
    public ApiResponse<ServiceCityPageResponse> publish(@PathVariable String serviceId, @PathVariable String citySlug,
                                                          @RequestBody ServiceCityVersionRequest request) {
        return ApiResponse.ok(service.publish(serviceId, citySlug, request.version(), CurrentUser.get()), "Страница опубликована");
    }

    @PostMapping("/{serviceId}/{citySlug}/archive")
    public ApiResponse<ServiceCityPageResponse> archive(@PathVariable String serviceId, @PathVariable String citySlug,
                                                          @RequestBody ServiceCityVersionRequest request) {
        return ApiResponse.ok(service.archive(serviceId, citySlug, request.version(), CurrentUser.get()), "Страница архивирована");
    }

    @PostMapping("/{serviceId}/{citySlug}/revoke-approval")
    public ApiResponse<ServiceCityPageResponse> revokeApproval(@PathVariable String serviceId, @PathVariable String citySlug,
                                                                 @RequestBody ServiceCityReasonRequest request) {
        return ApiResponse.ok(service.revokeApproval(serviceId, citySlug, request.version(), request.reason(), CurrentUser.get()),
                "Утверждение снято");
    }
}
