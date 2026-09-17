package kz.eco.content;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.content.dto.CreateExpertRequest;
import kz.eco.content.dto.ExpertDto;
import kz.eco.content.dto.VersionRequest;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Expert verification workflow - ADMIN/DIRECTOR only. Only VERIFIED experts are ever exposed by
 *  any public endpoint (see kz.eco.content.Expert#isPubliclyVisible()). */
@RestController
@RequestMapping("/api/admin/content/experts")
@PreAuthorize(SecurityExpressions.CONTENT_VERIFICATION)
public class ExpertController {

    private final ExpertService service;

    public ExpertController(ExpertService service) {
        this.service = service;
    }

    @org.springframework.web.bind.annotation.GetMapping
    public ApiResponse<List<ExpertDto>> list() {
        return ApiResponse.ok(service.findAllForAdmin());
    }

    @PostMapping
    public ApiResponse<ExpertDto> create(@RequestBody CreateExpertRequest request) {
        return ApiResponse.ok(service.create(request), "Эксперт создан");
    }

    @PostMapping("/{id}/submit-verification")
    public ApiResponse<ExpertDto> submitForVerification(@PathVariable Long id, @RequestBody VersionRequest request) {
        return ApiResponse.ok(service.submitForVerification(id, request.version()), "Отправлено на верификацию");
    }

    @PostMapping("/{id}/verify")
    public ApiResponse<ExpertDto> verify(@PathVariable Long id, @RequestBody VersionRequest request) {
        return ApiResponse.ok(service.verify(id, request.version(), CurrentUser.get()), "Эксперт подтверждён");
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<ExpertDto> reject(@PathVariable Long id, @RequestBody VersionRequest request) {
        return ApiResponse.ok(service.reject(id, request.version(), CurrentUser.get()), "Верификация отклонена");
    }
}
