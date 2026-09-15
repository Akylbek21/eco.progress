package kz.eco.news;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.news.dto.NewsReasonRequest;
import kz.eco.news.dto.NewsResponse;
import kz.eco.news.dto.NewsVersionRequest;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** SEO-review workflow: DRAFT -&gt; IN_REVIEW -&gt; APPROVED -&gt; PUBLISHED -&gt; ARCHIVED (see
 *  kz.eco.content.ContentStatus). Editorial gate only - ADMIN/DIRECTOR, same tier as
 *  SecurityExpressions.CITY_CONTENT_REVIEW. Every mutation is version-checked (optimistic locking,
 *  see kz.eco.content.ContentVersioning) - a stale version returns 409 VERSION_CONFLICT. */
@RestController
@RequestMapping("/api/admin/content/articles")
@PreAuthorize(SecurityExpressions.NEWS_REVIEW)
public class NewsReviewController {

    private final NewsService service;

    public NewsReviewController(NewsService service) {
        this.service = service;
    }

    @PostMapping("/{id}/submit-review")
    public ApiResponse<NewsResponse> submitForReview(@PathVariable String id, @RequestBody NewsVersionRequest request) {
        return ApiResponse.ok(service.submitForReview(id, request.version(), CurrentUser.get()), "Статья отправлена на проверку");
    }

    @PostMapping("/{id}/return-for-revision")
    public ApiResponse<NewsResponse> returnForRevision(@PathVariable String id, @RequestBody NewsReasonRequest request) {
        return ApiResponse.ok(service.returnForRevision(id, request.version(), request.reason(), CurrentUser.get()), "Статья возвращена на доработку");
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<NewsResponse> approve(@PathVariable String id, @RequestBody NewsVersionRequest request) {
        return ApiResponse.ok(service.approve(id, request.version(), CurrentUser.get()), "Статья утверждена");
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<NewsResponse> publish(@PathVariable String id, @RequestBody NewsVersionRequest request) {
        return ApiResponse.ok(service.publish(id, request.version(), CurrentUser.get()), "Статья опубликована");
    }

    @PostMapping("/{id}/archive")
    public ApiResponse<NewsResponse> archive(@PathVariable String id, @RequestBody NewsVersionRequest request) {
        return ApiResponse.ok(service.archive(id, request.version(), CurrentUser.get()), "Статья архивирована");
    }

    @PostMapping("/{id}/revoke-approval")
    public ApiResponse<NewsResponse> revokeApproval(@PathVariable String id, @RequestBody NewsReasonRequest request) {
        return ApiResponse.ok(service.revokeApproval(id, request.version(), request.reason(), CurrentUser.get()), "Утверждение снято");
    }
}
