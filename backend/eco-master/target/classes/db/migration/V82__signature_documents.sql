-- Signature Documents feature (kz.eco.signaturedoc): simplified, self-service, single-user
-- document upload + CMS/ECP signing + signed-package download, built on top of existing
-- infrastructure (kz.eco.storage.FileStorageService, kz.eco.signature.SignatureVerificationService).
-- Deliberately does NOT reuse kz.ecoprogress.documentflow's Document/DocumentVersion model -
-- this feature has no multi-version documents, no organization routing, no counterparties.

CREATE TABLE signature_documents (
    id BIGINT NOT NULL AUTO_INCREMENT,
    company_id BIGINT NOT NULL,
    created_by_user_id BIGINT NOT NULL,
    title VARCHAR(300) NOT NULL,
    description VARCHAR(2000) NULL,
    original_file_name VARCHAR(300) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    file_size BIGINT NOT NULL,
    storage_file_id VARCHAR(64) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    signed_at DATETIME NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- List endpoint filters by companyId + createdByUserId ("сотрудник видит только собственные
-- документы внутри своей организации") - this is the primary access pattern for every read.
CREATE INDEX ix_signature_documents_company_owner ON signature_documents (company_id, created_by_user_id);
CREATE INDEX ix_signature_documents_status ON signature_documents (status);

CREATE TABLE signature_document_signing_sessions (
    id VARCHAR(36) NOT NULL,
    document_id BIGINT NOT NULL,
    document_version INT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_signature_document_signing_sessions_document ON signature_document_signing_sessions (document_id);

CREATE TABLE signature_document_signatures (
    id BIGINT NOT NULL AUTO_INCREMENT,
    document_id BIGINT NOT NULL,
    document_version INT NOT NULL,
    signer_user_id BIGINT NOT NULL,
    cms_storage_id VARCHAR(64) NULL,
    certificate_serial_number VARCHAR(120) NULL,
    certificate_subject VARCHAR(500) NULL,
    certificate_issuer VARCHAR(500) NULL,
    certificate_iin VARCHAR(20) NULL,
    certificate_bin VARCHAR(20) NULL,
    certificate_valid_from DATE NULL,
    certificate_valid_to DATE NULL,
    signature_algorithm VARCHAR(60) NULL,
    file_sha256 VARCHAR(64) NULL,
    verification_status VARCHAR(30) NOT NULL,
    verification_message VARCHAR(1000) NULL,
    signed_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_signature_document_signatures_document ON signature_document_signatures (document_id);

CREATE TABLE signature_document_audit_log (
    id BIGINT NOT NULL AUTO_INCREMENT,
    document_id BIGINT NULL,
    action VARCHAR(40) NOT NULL,
    actor_user_id BIGINT NULL,
    company_id BIGINT NULL,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(300) NULL,
    timestamp DATETIME NOT NULL,
    result VARCHAR(20) NOT NULL,
    error_code VARCHAR(60) NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_signature_document_audit_log_document ON signature_document_audit_log (document_id);
