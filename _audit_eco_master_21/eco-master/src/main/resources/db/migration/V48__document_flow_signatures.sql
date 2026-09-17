-- One completed CMS signature per assignment. Mirrors protocol_signatures' uniqueness-as-race-
-- protection pattern (see kz.eco.protocol.ProtocolSignature): (assignment_id) and (request_id) are
-- both unique so a genuine double-click race is caught by the DB, not a pre-check alone.
--
-- trusted_timestamp is always NULL in this pass (no TSA/timestamp-authority integration - known
-- limitation, see DocumentFlowSignature javadoc). certificate_iin_hash/signer_iin never stores a
-- raw IIN, only its SHA-256 hex digest.

CREATE TABLE IF NOT EXISTS document_flow_signatures (
    id BIGINT NOT NULL AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    document_version_id BIGINT NOT NULL,
    route_id BIGINT NOT NULL,
    assignment_id BIGINT NOT NULL,
    signer_user_id BIGINT NULL,
    cms_storage_key VARCHAR(255) NOT NULL,
    cms_hash VARCHAR(64) NOT NULL,
    certificate_serial_number VARCHAR(128),
    certificate_subject VARCHAR(1000),
    certificate_issuer VARCHAR(1000),
    certificate_iin_hash VARCHAR(64),
    certificate_bin VARCHAR(20),
    certificate_valid_from DATE NULL,
    certificate_valid_to DATE NULL,
    signed_at TIMESTAMP NOT NULL,
    trusted_timestamp TIMESTAMP NULL,
    verification_status VARCHAR(30) NOT NULL,
    verification_details_json TEXT,
    request_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_document_flow_signatures_assignment UNIQUE (assignment_id),
    CONSTRAINT uk_document_flow_signatures_request UNIQUE (request_id),
    CONSTRAINT fk_document_flow_signatures_route FOREIGN KEY (route_id)
        REFERENCES document_flow_signing_routes (id),
    CONSTRAINT fk_document_flow_signatures_assignment FOREIGN KEY (assignment_id)
        REFERENCES document_flow_signing_assignments (id)
);

CREATE INDEX idx_document_flow_signatures_document ON document_flow_signatures (document_id);
CREATE INDEX idx_document_flow_signatures_route ON document_flow_signatures (route_id);

CREATE TABLE IF NOT EXISTS document_flow_audit_log (
    id BIGINT NOT NULL AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    action VARCHAR(100) NOT NULL,
    actor_user_id BIGINT NULL,
    details VARCHAR(2000),
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX idx_document_flow_audit_log_document ON document_flow_audit_log (document_id, created_at);
