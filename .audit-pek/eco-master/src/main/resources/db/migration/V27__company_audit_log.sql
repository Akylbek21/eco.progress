-- Generic audit trail for the Companies module (both Company and CompanyObject actions share
-- this table via entityType/entityId, per the spec) - mirrors protocol_audit_logs' shape and
-- MySQL-safe idempotent-creation pattern.
CREATE TABLE IF NOT EXISTS company_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(30) NOT NULL,
    entity_id BIGINT NOT NULL,
    action VARCHAR(30) NOT NULL,
    user_id BIGINT,
    user_name VARCHAR(255),
    changed_fields VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_company_audit_logs_entity (entity_type, entity_id),
    INDEX idx_company_audit_logs_created_at (created_at)
);
