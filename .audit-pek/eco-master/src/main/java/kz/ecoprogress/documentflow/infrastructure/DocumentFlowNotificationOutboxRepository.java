package kz.ecoprogress.documentflow.infrastructure;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentFlowNotificationOutboxRepository extends JpaRepository<DocumentFlowNotificationOutbox, Long> {
    List<DocumentFlowNotificationOutbox> findTop50ByStatusOrderByCreatedAtAsc(DocumentFlowNotificationOutboxStatus status);
}
