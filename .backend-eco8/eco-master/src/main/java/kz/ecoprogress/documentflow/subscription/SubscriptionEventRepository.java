package kz.ecoprogress.documentflow.subscription;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubscriptionEventRepository extends JpaRepository<SubscriptionEvent, Long> {
    List<SubscriptionEvent> findBySubscriptionIdOrderByCreatedAtAsc(Long subscriptionId);
    List<SubscriptionEvent> findByOrganizationIdOrderByCreatedAtAsc(Long organizationId);
}
