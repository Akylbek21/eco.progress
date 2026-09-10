-- CRM document library (kz.eco.documentlibrary): general-purpose staff document archive,
-- deliberately standalone - no FK columns to orders/companies/protocols/PEK/documentflow tables.
-- Reuses kz.eco.storage.FileStorageService (file_id is its opaque storage id) for actual bytes.

CREATE TABLE crm_documents (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(300) NOT NULL,
    category VARCHAR(40) NOT NULL,
    comment VARCHAR(2000) NULL,
    document_date DATE NULL,
    file_id VARCHAR(64) NOT NULL,
    original_filename VARCHAR(300) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by_user_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at DATETIME NULL,
    archived_by_user_id BIGINT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uq_crm_documents_file_id UNIQUE (file_id),
    CONSTRAINT fk_crm_documents_uploaded_by FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_crm_documents_category ON crm_documents (category);
CREATE INDEX ix_crm_documents_created_at ON crm_documents (created_at);
CREATE INDEX ix_crm_documents_uploaded_by ON crm_documents (uploaded_by_user_id);
CREATE INDEX ix_crm_documents_archived ON crm_documents (archived);
CREATE INDEX ix_crm_documents_document_date ON crm_documents (document_date);
