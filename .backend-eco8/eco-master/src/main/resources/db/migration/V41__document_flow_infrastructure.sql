-- Generic idempotency tracking (scope+key) and notification outbox for the document-flow module.
-- See kz.ecoprogress.documentflow.infrastructure.

CREATE TABLE IF NOT EXISTS document_flow_idempotency_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    scope VARCHAR(80) NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    result_id BIGINT NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_df_idempotency_scope_key UNIQUE (scope, idempotency_key)
);

CREATE TABLE IF NOT EXISTS document_flow_notification_outbox (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NULL,
    organization_id BIGINT NULL,
    title VARCHAR(300) NOT NULL,
    message VARCHAR(2000) NOT NULL,
    type VARCHAR(60) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    last_error VARCHAR(1000) NULL,
    created_at TIMESTAMP NOT NULL,
    sent_at TIMESTAMP NULL,
    PRIMARY KEY (id)
);

CREATE INDEX idx_df_notif_outbox_status ON document_flow_notification_outbox (status);
