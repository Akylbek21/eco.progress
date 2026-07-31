package kz.eco.audit;

import kz.eco.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLogService {

    private final AuditLogRepository repository;

    public AuditLogService(AuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void log(String entityType, Long entityId, String orderId,
                    User actor, String actionType,
                    String oldValue, String newValue, String comment) {
        AuditLog entry = new AuditLog();
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setOrderId(orderId);
        if (actor != null) {
            entry.setActorUserId(actor.getId());
            entry.setActorRole(actor.getRole().name());
        }
        entry.setActionType(actionType);
        entry.setOldValue(oldValue);
        entry.setNewValue(newValue);
        entry.setComment(comment);
        repository.save(entry);
    }
}
