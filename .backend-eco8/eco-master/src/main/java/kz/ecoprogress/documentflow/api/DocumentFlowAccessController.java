package kz.ecoprogress.documentflow.api;

import kz.eco.auth.CurrentUser;
import kz.eco.common.ApiResponse;
import kz.eco.user.User;
import kz.ecoprogress.documentflow.access.AccessContext;
import kz.ecoprogress.documentflow.access.DocumentFlowAccessService;
import kz.ecoprogress.documentflow.api.dto.AccessContextDto;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * GET /api/document-flow/access - "can I use this module, and what does it look like right now".
 * Resolves organizationId from the caller's own membership rows (never from client input, per
 * DocumentFlowAccessService's javadoc) - takes the first non-REMOVED membership found. A user
 * with zero memberships gets a benign "not available" response rather than a 404/403, since this
 * endpoint's whole purpose is to describe state, including the "you have no access" state.
 */
@RestController
@RequestMapping("/api/document-flow/access")
public class DocumentFlowAccessController {

    private final DocumentFlowAccessService accessService;
    private final DocumentFlowMembershipRepository membershipRepository;

    public DocumentFlowAccessController(DocumentFlowAccessService accessService,
                                         DocumentFlowMembershipRepository membershipRepository) {
        this.accessService = accessService;
        this.membershipRepository = membershipRepository;
    }

    @GetMapping
    public ApiResponse<AccessContextDto> getAccess() {
        User user = CurrentUser.get();
        List<DocumentFlowMembership> memberships = membershipRepository.findByUserIdAndStatusNot(user.getId(), MembershipStatus.REMOVED);
        if (memberships.isEmpty()) {
            AccessContext empty = new AccessContext(true, null, null, null, true, null,
                    java.util.Set.of(), java.util.Set.of(), java.util.Map.of(), java.util.Map.of(), List.of(),
                    null, null, null, "Пользователь не состоит ни в одной организации модуля документооборота");
            return ApiResponse.ok(AccessContextDto.from(empty));
        }
        Long organizationId = memberships.get(0).getOrganizationId();
        AccessContext context = accessService.getAccessContext(user.getId(), organizationId);
        return ApiResponse.ok(AccessContextDto.from(context));
    }
}
