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
        log(protocolId, action, oldStatus, newStatus, userId, comment, null, null);
    }

    /** Module spec §13: same as the 6-arg overload plus contentVersion before/after - use this at
     *  the transitions where capturing that matters most (workflow moves, signing). */
    @Transactional
    public void log(Long protocolId, ProtocolAuditAction action, ProtocolStatus oldStatus,
                    ProtocolStatus newStatus, Long userId, String comment,
                    Long oldVersion, Long newVersion) {
        ProtocolAuditLog log = new ProtocolAuditLog();
        log.setProtocolId(protocolId);
        log.setAction(action);
        log.setOldStatus(oldStatus);
        log.setNewStatus(newStatus);
        log.setUserId(userId);
        log.setComment(comment);
        log.setOldVersion(oldVersion);
        log.setNewVersion(newVersion);
        auditLogRepository.save(log);
    }
}
