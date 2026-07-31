package kz.eco.protocol;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProtocolAuditService {

    private final ProtocolAuditLogRepository auditLogRepository;

    public ProtocolAuditService(ProtocolAuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public void log(Long protocolId, ProtocolAuditAction action, ProtocolStatus oldStatus,
                    ProtocolStatus newStatus, Long userId, String comment) {
        ProtocolAuditLog log = new ProtocolAuditLog();
        log.setProtocolId(protocolId);
        log.setAction(action);
        log.setOldStatus(oldStatus);
        log.setNewStatus(newStatus);
        log.setUserId(userId);
        log.setComment(comment);
        auditLogRepository.save(log);
    }
}
