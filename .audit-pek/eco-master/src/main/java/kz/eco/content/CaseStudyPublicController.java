package kz.eco.content;

import kz.eco.common.ApiResponse;
import kz.eco.content.dto.CaseStudyResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Public, unauthenticated surface - see SecurityConfig's permitAll matcher for
 *  /api/public/content/**. Editorial workflow lives in {@link CaseStudyAdminController}. */
@RestController
@RequestMapping("/api/public/content/cases")
public class CaseStudyPublicController {

    private final CaseStudyService service;

    public CaseStudyPublicController(CaseStudyService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<CaseStudyResponse>> list() {
        return ApiResponse.ok(service.findAllIndexable());
    }

    @GetMapping("/{slug}")
    public ApiResponse<CaseStudyResponse> get(@PathVariable String slug) {
        return ApiResponse.ok(service.findById(slug));
    }
}
