-- PEK final-report document generation (Iteration 3 of the PEK module overhaul). Every DOCX/PDF
-- generation for a report inserts a new version row - old versions are NEVER deleted or updated,
-- new generation always appends. snapshot_json captures the exact data used to render the
-- document, for audit/reproducibility even if the underlying report/plan-fact/exceedance rows
-- later change.
CREATE TABLE pek_report_document_versions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    report_id BIGINT NOT NULL,
    version INT NOT NULL,
    snapshot_json LONGTEXT NOT NULL,
    docx_file_id VARCHAR(64) NULL,
    pdf_file_id VARCHAR(64) NULL,
    content_hash VARCHAR(64) NOT NULL,
    generated_at DATETIME NOT NULL,
    generated_by BIGINT NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_pek_report_document_versions_report_version UNIQUE (report_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_pek_report_document_versions_report_id ON pek_report_document_versions (report_id);
