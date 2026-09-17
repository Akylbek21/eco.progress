package kz.eco.pek;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.pek.dto.PekApiDtos;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pek/scope")
public class PekScopeController {
    private final PekScopeService service;
    public PekScopeController(PekScopeService service) { this.service = service; }

    @GetMapping("/companies")
    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    public ApiResponse<List<PekApiDtos.ScopeCompanyResponse>> companies() {
        return ApiResponse.ok(service.companies(CurrentUser.get()));
    }

    @GetMapping("/companies/{companyId}/objects")
    @PreAuthorize(PekSecurityExpressions.PEK_VIEW)
    public ApiResponse<List<PekApiDtos.ScopeCompanyObjectResponse>> objects(@PathVariable Long companyId) {
        return ApiResponse.ok(service.objects(CurrentUser.get(), companyId));
    }
}
