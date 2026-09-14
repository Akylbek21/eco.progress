package kz.ecoprogress.documentflow.subscription;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrganizationSubscriptionRepository extends JpaRepository<OrganizationSubscription, Long> {
    List<OrganizationSubscription> findByOrganizationId(Long organizationId);
    List<OrganizationSubscription> findByOrganizationIdAndStatusIn(Long organizationId, List<SubscriptionStatus> statuses);
    List<OrganizationSubscription> findByStatus(SubscriptionStatus status);
    List<OrganizationSubscription> findByStatusAndTrialEndsAtBefore(SubscriptionStatus status, LocalDateTime now);
    List<OrganizationSubscription> findByStatusAndExpiresAtBefore(SubscriptionStatus status, LocalDateTime now);
    List<OrganizationSubscription> findByStatusAndGraceEndsAtBefore(SubscriptionStatus status, LocalDateTime now);

    default Optional<OrganizationSubscription> findCurrentNonTerminal(Long organizationId, List<SubscriptionStatus> nonTerminal) {
        return findByOrganizationIdAndStatusIn(organizationId, nonTerminal).stream()
                .max((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()));
    }

    /** Unlike {@link #findCurrentNonTerminal}, includes EXPIRED/CANCELLED rows - needed wherever
     *  read-only access must still be evaluated (EXPIRED means "read-only", not "no subscription
     *  ever existed") rather than treated as absent. */
    default Optional<OrganizationSubscription> findMostRecent(Long organizationId) {
        return findByOrganizationId(organizationId).stream()
                .max((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()));
    }
}
