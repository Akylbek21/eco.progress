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
}
