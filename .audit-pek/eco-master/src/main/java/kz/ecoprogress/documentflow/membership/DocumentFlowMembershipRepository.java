package kz.ecoprogress.documentflow.membership;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentFlowMembershipRepository extends JpaRepository<DocumentFlowMembership, Long> {
    Optional<DocumentFlowMembership> findByOrganizationIdAndUserIdAndStatus(Long organizationId, Long userId, MembershipStatus status);
    Optional<DocumentFlowMembership> findByOrganizationIdAndUserId(Long organizationId, Long userId);
    List<DocumentFlowMembership> findByUserIdAndStatusNot(Long userId, MembershipStatus status);
    List<DocumentFlowMembership> findByOrganizationIdAndStatus(Long organizationId, MembershipStatus status);
    List<DocumentFlowMembership> findByOrganizationIdAndStatusNot(Long organizationId, MembershipStatus status);
    long countByOrganizationIdAndStatus(Long organizationId, MembershipStatus status);
    boolean existsByOrganizationIdAndStatusAndRoleCode(Long organizationId, MembershipStatus status, MembershipRole roleCode);
    long countByOrganizationIdAndStatusAndRoleCode(Long organizationId, MembershipStatus status, MembershipRole roleCode);
    /** Batch load for the admin org-access list - one query for a whole page of organization ids,
     *  never a per-row query. */
    List<DocumentFlowMembership> findByOrganizationIdInAndStatus(List<Long> organizationIds, MembershipStatus status);
}
