package kz.eco.content;

import kz.eco.common.ApiResponse;
import kz.eco.content.dto.TrustDocumentPublicDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Public, unauthenticated surface - see SecurityConfig's permitAll matcher for
 *  /api/public/content/**. Only VERIFIED, non-expired trust documents are returned - admin
 *  workflow lives in {@link TrustDocumentController}. */
@RestController
@RequestMapping("/api/public/content/trust-documents")
public class TrustDocumentPublicController {

    private final TrustDocumentService service;

    public TrustDocumentPublicController(TrustDocumentService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<TrustDocumentPublicDto>> list() {
        return ApiResponse.ok(service.findAllVerified());
    }
}
