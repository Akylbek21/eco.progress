package kz.ecoprogress.documentflow.access;

import kz.eco.common.exception.BadRequestException;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Resolves "which organization did this user mean" from their real, active memberships - used by
 * DocumentController/CounterpartyController so a request body's optional organizationId is NEVER
 * trusted blindly: it only disambiguates which of the caller's own memberships they mean,
 * validated against DocumentFlowMembershipRepository, never accepted on faith.
 */
@Component
public class OrganizationResolver {

    private final DocumentFlowMembershipRepository membershipRepository;

    public OrganizationResolver(DocumentFlowMembershipRepository membershipRepository) {
        this.membershipRepository = membershipRepository;
    }

    /** @param requestedOrganizationId optional, client-supplied hint - only used to pick among the
     *  user's own real memberships, never accepted on faith. */
    public Long resolve(Long userId, Long requestedOrganizationId) {
        List<DocumentFlowMembership> memberships =
                membershipRepository.findByUserIdAndStatusNot(userId, MembershipStatus.REMOVED);
        if (memberships.isEmpty()) {
            throw new BadRequestException("Пользователь не состоит ни в одной организации модуля документооборота");
        }
        if (requestedOrganizationId != null) {
            boolean belongs = memberships.stream()
                    .anyMatch(m -> m.getOrganizationId().equals(requestedOrganizationId));
            if (!belongs) {
                throw new BadRequestException("Пользователь не состоит в указанной организации");
            }
            return requestedOrganizationId;
        }
        if (memberships.size() > 1) {
            throw new BadRequestException(
                    "Пользователь состоит в нескольких организациях - укажите organizationId явно");
        }
        return memberships.get(0).getOrganizationId();
    }
}
