package kz.eco.content;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.content.dto.CreateTrustDocumentRequest;
import kz.eco.content.dto.TrustDocumentDto;
import kz.eco.content.dto.VersionRequest;
import kz.eco.user.SecurityExpressions;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** TrustDocument verification workflow - ADMIN/DIRECTOR only. Only VERIFIED, non-expired documents
 *  are ever exposed by any public endpoint (see kz.eco.content.TrustDocument#isPubliclyVisible()). */
@RestController
@RequestMapping("/api/admin/content/trust-documents")
@PreAuthorize(SecurityExpressions.CONTENT_VERIFICATION)
public class TrustDocumentController {

    private final TrustDocumentService service;

    public TrustDocumentController(TrustDocumentService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<TrustDocumentDto>> list() {
        return ApiResponse.ok(service.findAllForAdmin());
    }

    @PostMapping
    public ApiResponse<TrustDocumentDto> create(@RequestBody CreateTrustDocumentRequest request) {
        return ApiResponse.ok(service.create(request), "Документ создан");
    }

    @PostMapping("/{id}/submit-verification")
    public ApiResponse<TrustDocumentDto> submitForVerification(@PathVariable Long id, @RequestBody VersionRequest request) {
        return ApiResponse.ok(service.submitForVerification(id, request.version()), "Отправлено на верификацию");
    }

    @PostMapping("/{id}/verify")
    public ApiResponse<TrustDocumentDto> verify(@PathVariable Long id, @RequestBody VersionRequest request) {
        return ApiResponse.ok(service.verify(id, request.version(), CurrentUser.get()), "Документ подтверждён");
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<TrustDocumentDto> reject(@PathVariable Long id, @RequestBody VersionRequest request) {
        return ApiResponse.ok(service.reject(id, request.version(), CurrentUser.get()), "Верификация отклонена");
    }
}
