package kz.ecoprogress.documentflow.admin;

import kz.ecoprogress.documentflow.membership.DocumentFlowMembership;
import kz.ecoprogress.documentflow.membership.DocumentFlowMembershipRepository;
import kz.ecoprogress.documentflow.membership.MembershipRole;
import kz.ecoprogress.documentflow.membership.MembershipStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Batch-loads activeMemberCount / hasOwner for a page of organization ids in one query each -
 * never a per-row query - for {@link AdminOrganizationAccessQueryService}'s list endpoint.
 */
@Component
public class AdminMembershipCountBatchLoader {

    private final DocumentFlowMembershipRepository membershipRepository;

    public AdminMembershipCountBatchLoader(DocumentFlowMembershipRepository membershipRepository) {
        this.membershipRepository = membershipRepository;
    }

    public record Counts(Map<Long, Long> activeMemberCounts, Set<Long> orgsWithActiveOwner) {
    }

    @Transactional(readOnly = true)
    public Counts load(List<Long> organizationIds) {
        if (organizationIds.isEmpty()) {
            return new Counts(Map.of(), Set.of());
        }
        List<DocumentFlowMembership> activeMemberships = membershipRepository
                .findByOrganizationIdInAndStatus(organizationIds, MembershipStatus.ACTIVE);

        Map<Long, Long> counts = new HashMap<>();
        Set<Long> ownersFound = new HashSet<>();
        for (DocumentFlowMembership m : activeMemberships) {
            counts.merge(m.getOrganizationId(), 1L, Long::sum);
            if (m.getRoleCode() == MembershipRole.OWNER) {
                ownersFound.add(m.getOrganizationId());
            }
        }
        return new Counts(counts, ownersFound);
    }
}
