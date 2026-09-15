package kz.eco.normative;

import kz.eco.audit.AuditLogService;
import kz.eco.auth.CurrentUser;
import kz.eco.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * Audit trail раздела «Нормативы» поверх общего {@link AuditLogService} (таблица audit_logs):
 * кто (actor из SecurityContext), когда (createdAt записи), какое действие, id записи и, где
 * это имеет смысл, снимки до/после в JSON.
 */
@Service
public class NormativeAuditService {

    public static final String ENTITY_NORMATIVE = "NORMATIVE";
    public static final String ENTITY_IMPORT = "NORMATIVE_IMPORT";

    public static final String ACTION_CREATE = "NORMATIVE_CREATE";
    public static final String ACTION_UPDATE = "NORMATIVE_UPDATE";
    public static final String ACTION_ARCHIVE = "NORMATIVE_ARCHIVE";
    public static final String ACTION_RESTORE = "NORMATIVE_RESTORE";
    public static final String ACTION_IMPORT_PREVIEW = "NORMATIVE_IMPORT_PREVIEW";
    public static final String ACTION_IMPORT_CONFIRM = "NORMATIVE_IMPORT_CONFIRM";
    public static final String ACTION_IMPORT_FAILED = "NORMATIVE_IMPORT_FAILED";
    public static final String ACTION_IMPORT_ROLLBACK = "NORMATIVE_IMPORT_ROLLBACK";

    /** audit_logs.old_value/new_value - VARCHAR(4000). */
    private static final int MAX_VALUE_LENGTH = 4000;

    private static final Logger log = LoggerFactory.getLogger(NormativeAuditService.class);

    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    public NormativeAuditService(AuditLogService auditLogService, ObjectMapper objectMapper) {
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    public void log(String entityType, Long entityId, String action, Object before, Object after, String comment) {
        User actor = CurrentUser.getOrNull();
        auditLogService.log(entityType, entityId, null, actor, action,
                toJson(before), toJson(after), truncate(comment, 2000));
    }

    public static Long currentUserId() {
        User user = CurrentUser.getOrNull();
        return user != null ? user.getId() : null;
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String s) {
            return truncate(s, MAX_VALUE_LENGTH);
        }
        try {
            return truncate(objectMapper.writeValueAsString(value), MAX_VALUE_LENGTH);
        } catch (RuntimeException e) {
            log.warn("Не удалось сериализовать audit-снимок норматива: {}", e.getMessage());
            return null;
        }
    }

    private static String truncate(String value, int max) {
        if (value == null || value.length() <= max) {
            return value;
        }
        return value.substring(0, max);
    }
}
