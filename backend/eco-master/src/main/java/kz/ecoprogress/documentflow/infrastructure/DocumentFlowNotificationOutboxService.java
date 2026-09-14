package kz.ecoprogress.documentflow.infrastructure;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DocumentFlowNotificationOutboxService {

    private final DocumentFlowNotificationOutboxRepository repository;

    public DocumentFlowNotificationOutboxService(DocumentFlowNotificationOutboxRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void enqueue(Long userId, Long organizationId, String title, String message, String type) {
        DocumentFlowNotificationOutbox row = new DocumentFlowNotificationOutbox();
        row.setUserId(userId);
        row.setOrganizationId(organizationId);
        row.setTitle(title);
        row.setMessage(message);
        row.setType(type);
        repository.save(row);
    }
}
