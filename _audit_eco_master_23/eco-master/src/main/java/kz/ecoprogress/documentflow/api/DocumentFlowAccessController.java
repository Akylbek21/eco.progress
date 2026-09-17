package kz.ecoprogress.documentflow.api;

import kz.eco.auth.CurrentUser;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.ApiResponse;
import kz.eco.company.Company;
import kz.eco.company.CompanyRepository;
import kz.eco.user.User;
import kz.ecoprogress.documentflow.access.AccessContext;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.access.DocumentFlowInternalModeProperties;
import kz.ecoprogress.documentflow.access.DocumentFlowMembershipRequiredException;
import kz.ecoprogress.documentflow.access.OrganizationResolver;
import kz.ecoprogress.documentflow.api.dto.AccessContextDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;

/**
 * GET /api/document-flow/access - "can I use this module, and what does it look like right now".
 * Resolves the organization the same way every other document-flow endpoint does, through
 * {@link OrganizationResolver} - never picks an arbitrary "first" membership when a user has more
 * than one (module spec §2: that used to be exactly the bug here), and in internal-mode
 * auto-provisions a system ADMIN's OWNER membership on first call rather than describing them as
 * having no access. A user with genuinely zero memberships (and nothing to auto-provision) still
 * gets a benign "not available" response rather than a 404/403, since this endpoint's whole purpose
 * is to describe state, including the "you have no access" state.
 */
@RestController
@RequestMapping("/api/document-flow/access")
public class DocumentFlowAccessController {

    private final DocumentFlowAccessService accessService;
    private final OrganizationResolver organizationResolver;
    private final DocumentFlowInternalModeProperties internalModeProperties;
    private final CompanyRepository companyRepository;

    public DocumentFlowAccessController(DocumentFlowAccessService accessService,
                                         OrganizationResolver organizationResolver,
                                         DocumentFlowInternalModeProperties internalModeProperties,
                                         CompanyRepository companyRepository) {
        this.accessService = accessService;
        this.organizationResolver = organizationResolver;
        this.internalModeProperties = internalModeProperties;
        this.companyRepository = companyRepository;
    }

    @GetMapping
    public ApiResponse<AccessContextDto> getAccess(
            @org.springframework.web.bind.annotation.RequestParam(required = false) Long organizationId) {
        User user = CurrentUser.get();
        boolean internalMode = internalModeProperties.isInternalMode();
        Long resolvedOrganizationId;
        try {
            // Module spec §4: a multi-org user must be able to pick which tenant is active by
            // passing organizationId explicitly - OrganizationResolver already supports this
            // parameter (validates it against the caller's real memberships), it just was never
            // wired up from this controller before. The "refuse to guess a first membership" and
            // "explicit id not a real membership -> reject" behavior in the resolver is unchanged.
            resolvedOrganizationId = organizationResolver.resolve(user.getId(), organizationId);
        } catch (DocumentFlowMembershipRequiredException | BadRequestException ex) {
            // No membership at all (and internal-mode auto-provisioning didn't apply - not an
            // ADMIN, or belongs to several organizations already) - describe "not available"
            // rather than surfacing this as an error, matching this endpoint's own contract.
            AccessContext empty = new AccessContext(true, null, null, null, null, null, true, null,
                    Set.of(), Set.of(), java.util.Map.of(), java.util.Map.of(), List.of(),
                    null, null, null, "Пользователь не состоит ни в одной организации модуля документооборота", false);
            return ApiResponse.ok(AccessContextDto.from(empty, internalMode, null));
        }
        AccessContext context = accessService.getAccessContext(user.getId(), resolvedOrganizationId);
        Company organization = companyRepository.findById(resolvedOrganizationId).orElse(null);
        return ApiResponse.ok(AccessContextDto.from(context, internalMode, organization));
    }
}
