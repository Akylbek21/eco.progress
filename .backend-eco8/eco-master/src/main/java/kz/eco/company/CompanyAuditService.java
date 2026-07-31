package kz.eco.company;

import kz.eco.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CompanyAuditService {

    private final CompanyAuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    public CompanyAuditService(CompanyAuditLogRepository auditLogRepository, UserRepository userRepository) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void log(String entityType, Long entityId, CompanyAuditAction action, Long userId, List<String> changedFields) {
        CompanyAuditLog log = new CompanyAuditLog();
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setAction(action);
        log.setUserId(userId);
        log.setUserName(userId != null
                ? userRepository.findById(userId).map(kz.eco.user.User::getName).orElse(null)
                : null);
        log.setChangedFields(changedFields != null && !changedFields.isEmpty() ? String.join(",", changedFields) : null);
        auditLogRepository.save(log);
    }
}
