package kz.eco.content;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.content.dto.CaseStudyResponse;
import kz.eco.content.dto.CreateCaseStudyRequest;
import kz.eco.content.dto.ServiceCityReasonRequest;
import kz.eco.content.dto.UpdateCaseStudyRequest;
import kz.eco.content.dto.VersionRequest;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** CaseStudy CMS admin API - DRAFT -&gt; IN_REVIEW -&gt; APPROVED -&gt; PUBLISHED -&gt; ARCHIVED (see
 *  kz.eco.content.ContentStatus). Editorial gate only - ADMIN/DIRECTOR. Every mutation is
 *  version-checked - a stale version returns 409 VERSION_CONFLICT. */
@RestController
@RequestMapping("/api/admin/content/cases")
@PreAuthorize(SecurityExpressions.CASE_STUDY_REVIEW)
public class CaseStudyAdminController {

    private final CaseStudyService service;

    public CaseStudyAdminController(CaseStudyService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<CaseStudyResponse>> list() {
        return ApiResponse.ok(service.findAllForAdmin());
    }

    @PostMapping
    public ApiResponse<CaseStudyResponse> create(@RequestBody CreateCaseStudyRequest request) {
        return ApiResponse.ok(service.create(request, CurrentUser.get()), "Кейс создан");
    }

    @GetMapping("/{id}")
    public ApiResponse<CaseStudyResponse> get(@PathVariable String id) {
        return ApiResponse.ok(service.findById(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<CaseStudyResponse> update(@PathVariable String id, @RequestBody UpdateCaseStudyRequest request) {
        return ApiResponse.ok(service.update(id, request, CurrentUser.get()), "Кейс обновлён");
    }

    @PostMapping("/{id}/submit-review")
    public ApiResponse<CaseStudyResponse> submitForReview(@PathVariable String id, @RequestBody VersionRequest request) {
        return ApiResponse.ok(service.submitForReview(id, request.version(), CurrentUser.get()), "Кейс отправлен на проверку");
    }

    @PostMapping("/{id}/return-for-revision")
    public ApiResponse<CaseStudyResponse> returnForRevision(@PathVariable String id, @RequestBody ServiceCityReasonRequest request) {
        return ApiResponse.ok(service.returnForRevision(id, request.version(), request.reason(), CurrentUser.get()), "Кейс возвращён на доработку");
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<CaseStudyResponse> approve(@PathVariable String id, @RequestBody VersionRequest request) {
        return ApiResponse.ok(service.approve(id, request.version(), CurrentUser.get()), "Кейс утверждён");
    }

    @PostMapping("/{id}/publish")
    public ApiResponse<CaseStudyResponse> publish(@PathVariable String id, @RequestBody VersionRequest request) {
        return ApiResponse.ok(service.publish(id, request.version(), CurrentUser.get()), "Кейс опубликован");
    }

    @PostMapping("/{id}/archive")
    public ApiResponse<CaseStudyResponse> archive(@PathVariable String id, @RequestBody VersionRequest request) {
        return ApiResponse.ok(service.archive(id, request.version(), CurrentUser.get()), "Кейс архивирован");
    }
}
