package kz.ecoprogress.documentflow.signing;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DocumentFlowAuditService {

    private final DocumentFlowAuditLogRepository repository;

    public DocumentFlowAuditService(DocumentFlowAuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void log(Long documentId, String action, Long actorUserId, String details) {
        DocumentFlowAuditLog log = new DocumentFlowAuditLog();
        log.setDocumentId(documentId);
        log.setAction(action);
        log.setActorUserId(actorUserId);
        log.setDetails(details);
        repository.save(log);
    }
}
