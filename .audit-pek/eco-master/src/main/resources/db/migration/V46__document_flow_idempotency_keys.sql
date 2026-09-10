-- Document Flow module - TEMPORARY document-flow-scoped Idempotency-Key store for
-- POST /api/document-flow/documents. See kz.ecoprogress.documentflow.infrastructure.
-- TODO-RECONCILE: drop this table if Agent A's shared module-wide idempotency infrastructure
-- (kz.ecoprogress.documentflow.infrastructure) lands with a compatible/broader shape.

CREATE TABLE IF NOT EXISTS document_flow_idempotency_keys (
    id BIGINT NOT NULL AUTO_INCREMENT,
    organization_id BIGINT NOT NULL,
    idempotency_key VARCHAR(200) NOT NULL,
    result_document_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_dfik_org_key UNIQUE (organization_id, idempotency_key)
);
