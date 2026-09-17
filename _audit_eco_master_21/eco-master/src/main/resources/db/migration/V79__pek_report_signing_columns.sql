-- PEK final-report signing (Iteration 3). Modeled as a separate table (mirrors
-- protocol_signatures's precedent of "signature state lives in its own row, not bolted onto the
-- parent entity as columns") rather than columns on pek_reports, since a report signature refers
-- to a specific document version and carries its own certificate metadata. Raw CMS bytes are never
-- stored in a DB column - only the FileStorageService fileId reference (cms_file_id), same pattern
-- as protocol_signatures.signature_file_id.
CREATE TABLE pek_report_signatures (
    id BIGINT NOT NULL AUTO_INCREMENT,
    report_id BIGINT NOT NULL,
    document_version_id BIGINT NOT NULL,
    signer_user_id BIGINT NOT NULL,
    signed_at DATETIME NOT NULL,
    document_hash VARCHAR(64) NOT NULL,
    signature_type VARCHAR(30) NOT NULL DEFAULT 'CMS',
    cms_file_id VARCHAR(64) NOT NULL,
    certificate_subject VARCHAR(500) NULL,
    certificate_cn VARCHAR(255) NULL,
    certificate_serial VARCHAR(100) NULL,
    certificate_organization VARCHAR(255) NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_pek_report_signatures_version FOREIGN KEY (document_version_id)
        REFERENCES pek_report_document_versions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_pek_report_signatures_report_id ON pek_report_signatures (report_id);
