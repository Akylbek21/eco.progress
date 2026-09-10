-- Document Flow (Документооборот) module - document core. See kz.ecoprogress.documentflow.document
-- and kz.ecoprogress.documentflow.version packages. Also includes the TEMPORARY
-- document_flow_temp_memberships table (kz.ecoprogress.documentflow.access.DocumentFlowMembership)
-- which stands in for Agent A's real membership/subscription tables until that branch merges -
-- TODO-RECONCILE: drop document_flow_temp_memberships once Agent A's membership schema lands.

CREATE TABLE IF NOT EXISTS document_flow_temp_memberships (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,
    can_write BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id)
);

CREATE INDEX idx_dftm_user_org ON document_flow_temp_memberships (user_id, organization_id);

CREATE TABLE IF NOT EXISTS document_flow_documents (
    id BIGINT NOT NULL AUTO_INCREMENT,
    public_id VARCHAR(40) NOT NULL,
    organization_id BIGINT NOT NULL,
    sender_organization_id BIGINT,
    recipient_organization_id BIGINT,
    counterparty_id BIGINT,
    document_number VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    description VARCHAR(4000),
    document_type VARCHAR(60) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL,
    current_version_id BIGINT,
    author_user_id BIGINT NOT NULL,
    signing_deadline TIMESTAMP NULL,
    sent_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    archived_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_dfd_public_id UNIQUE (public_id)
);

CREATE INDEX idx_dfd_org ON document_flow_documents (organization_id);
CREATE INDEX idx_dfd_status ON document_flow_documents (status);
CREATE INDEX idx_dfd_public_id ON document_flow_documents (public_id);
CREATE INDEX idx_dfd_counterparty ON document_flow_documents (counterparty_id);

CREATE TABLE IF NOT EXISTS document_flow_document_versions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    version_number INT NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    file_size BIGINT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    preview_storage_key VARCHAR(255),
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_at TIMESTAMP NULL,
    locked_by BIGINT,
    change_reason VARCHAR(1000),
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_dfdv_document FOREIGN KEY (document_id) REFERENCES document_flow_documents (id)
);

CREATE INDEX idx_dfdv_document ON document_flow_document_versions (document_id);
CREATE INDEX idx_dfdv_current ON document_flow_document_versions (document_id, is_current);

ALTER TABLE document_flow_documents
    ADD CONSTRAINT fk_dfd_current_version FOREIGN KEY (current_version_id) REFERENCES document_flow_document_versions (id);
