package kz.ecoprogress.documentflow.membership;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface MembershipInvitationRepository extends JpaRepository<MembershipInvitation, Long> {
    Optional<MembershipInvitation> findByTokenHash(String tokenHash);
    Optional<MembershipInvitation> findFirstByOrganizationIdAndUserIdAndStatusOrderByCreatedAtDesc(
            Long organizationId, Long userId, MembershipInvitationStatus status);
}
