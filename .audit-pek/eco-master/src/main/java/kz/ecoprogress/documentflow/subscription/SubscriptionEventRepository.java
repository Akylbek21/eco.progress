package kz.ecoprogress.documentflow.subscription;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface SubscriptionEventRepository extends JpaRepository<SubscriptionEvent, Long> {
    List<SubscriptionEvent> findBySubscriptionIdOrderByCreatedAtAsc(Long subscriptionId);
    List<SubscriptionEvent> findByOrganizationIdOrderByCreatedAtAsc(Long organizationId);

    /** Paginated history for GET .../subscriptions/{organizationId}/events (task item 11/15). */
    Page<SubscriptionEvent> findByOrganizationId(Long organizationId, Pageable pageable);
    Page<SubscriptionEvent> findByOrganizationIdAndEventType(Long organizationId, SubscriptionEventType eventType, Pageable pageable);
    Page<SubscriptionEvent> findByOrganizationIdAndCreatedAtBetween(Long organizationId, LocalDateTime from, LocalDateTime to, Pageable pageable);
    Page<SubscriptionEvent> findByOrganizationIdAndEventTypeAndCreatedAtBetween(Long organizationId, SubscriptionEventType eventType, LocalDateTime from, LocalDateTime to, Pageable pageable);
}
