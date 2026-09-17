-- Revocation requests for already-signed documents. Approving one transitions the ORIGINAL
-- document to REVOKED via DocumentService.transitionStatus() - the document row itself is never
-- deleted, only status-transitioned, so its full version/signature/audit history stays readable.

CREATE TABLE IF NOT EXISTS document_flow_revocation_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    requested_by BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    reason VARCHAR(2000),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP NULL,
    resolved_by BIGINT NULL,
    resolution_comment VARCHAR(2000),
    PRIMARY KEY (id)
);

CREATE INDEX idx_document_flow_revocation_requests_document ON document_flow_revocation_requests (document_id);
CREATE INDEX idx_document_flow_revocation_requests_status ON document_flow_revocation_requests (status);
