package kz.ecoprogress.documentflow.api;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.company.Company;
import kz.eco.company.CompanyRepository;
import kz.eco.user.User;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.api.dto.DocumentFlowOrganizationDto;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * GET /api/document-flow/organizations (module spec §4) - lets a multi-org user discover which
 * organizations they belong to (only their own, non-REMOVED memberships - never another user's)
 * so the frontend can drive the {@code organizationId} param on /access and every other
 * document-flow endpoint instead of guessing or defaulting to a "first" membership.
 */
@RestController
@RequestMapping("/api/document-flow/organizations")
public class DocumentFlowOrganizationController {

    private final DocumentFlowMembershipRepository membershipRepository;
    private final CompanyRepository companyRepository;
    private final DocumentFlowAccessService accessService;

    public DocumentFlowOrganizationController(DocumentFlowMembershipRepository membershipRepository,
                                               CompanyRepository companyRepository,
                                               DocumentFlowAccessService accessService) {
        this.membershipRepository = membershipRepository;
        this.companyRepository = companyRepository;
        this.accessService = accessService;
    }

    @GetMapping
    public ApiResponse<List<DocumentFlowOrganizationDto>> list() {
        User user = CurrentUser.get();
        List<DocumentFlowMembership> memberships = membershipRepository.findByUserIdAndStatusNot(
                user.getId(), MembershipStatus.REMOVED);
        List<DocumentFlowOrganizationDto> result = memberships.stream()
                // readOnly reuses the exact same subscription-driven definition /access itself
                // uses (DocumentFlowAccessService#getAccessContext), not just membership status,
                // so the two endpoints never disagree about whether an org is writable.
                .map(m -> {
                    Company company = companyRepository.findById(m.getOrganizationId()).orElse(null);
                    boolean readOnly = accessService.getAccessContext(user.getId(), m.getOrganizationId()).readOnly();
                    return new DocumentFlowOrganizationDto(
                            m.getOrganizationId(),
                            company != null ? company.getName() : null,
                            company != null ? company.getBin() : null,
                            m.getRoleCode(),
                            m.getStatus(),
                            readOnly);
                })
                .toList();
        return ApiResponse.ok(result);
    }
}
