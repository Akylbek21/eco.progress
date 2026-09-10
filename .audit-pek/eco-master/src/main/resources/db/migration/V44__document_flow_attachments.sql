-- Document Flow module - free-form attachments distinct from the versioned primary document file.
-- See kz.ecoprogress.documentflow.attachment.

CREATE TABLE IF NOT EXISTS document_flow_attachments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    original_file_name VARCHAR(500) NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    file_size BIGINT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    uploaded_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_dfa_document FOREIGN KEY (document_id) REFERENCES document_flow_documents (id)
);

CREATE INDEX idx_dfa_document ON document_flow_attachments (document_id);
