package kz.ecoprogress.documentflow.infrastructure;

import kz.eco.notification.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Polls the outbox and turns each row into a real in-app notification via
 *  kz.eco.notification.NotificationService, exactly like kz.eco.mail.EmailOutboxProcessor does
 *  for outgoing emails. */
@Component
public class DocumentFlowNotificationOutboxProcessor {

    private static final Logger log = LoggerFactory.getLogger(DocumentFlowNotificationOutboxProcessor.class);

    private final DocumentFlowNotificationOutboxRepository repository;
    private final NotificationService notificationService;

    public DocumentFlowNotificationOutboxProcessor(DocumentFlowNotificationOutboxRepository repository,
                                                    NotificationService notificationService) {
        this.repository = repository;
        this.notificationService = notificationService;
    }

    @Scheduled(fixedDelayString = "${eco.document-flow.notification-poll-interval-ms:15000}")
    @Transactional
    public void processPending() {
        List<DocumentFlowNotificationOutbox> batch = repository.findTop50ByStatusOrderByCreatedAtAsc(DocumentFlowNotificationOutboxStatus.PENDING);
        for (DocumentFlowNotificationOutbox row : batch) {
            deliver(row);
        }
    }

    private void deliver(DocumentFlowNotificationOutbox row) {
        row.setAttempts(row.getAttempts() + 1);
        try {
            if (row.getUserId() != null) {
                notificationService.notify(row.getUserId(), null, null, row.getTitle(), row.getMessage(), row.getType());
            }
            row.setStatus(DocumentFlowNotificationOutboxStatus.SENT);
            row.setSentAt(LocalDateTime.now());
            repository.save(row);
        } catch (Exception e) {
            row.setLastError(e.getMessage());
            if (row.getAttempts() >= 5) {
                row.setStatus(DocumentFlowNotificationOutboxStatus.FAILED);
            }
            repository.save(row);
            log.warn("Document-flow notification delivery failed id={}: {}", row.getId(), e.getMessage());
        }
    }
}
