-- Corrective-action workflow fields on pek_report_exceedances (Iteration 2 of the PEK module
-- overhaul) - additive only, existing rows get NULL for all new columns (still valid: an existing
-- OPEN exceedance simply has no responsible/corrective-action assigned yet).
ALTER TABLE pek_report_exceedances ADD COLUMN responsible_user_id BIGINT NULL;
ALTER TABLE pek_report_exceedances ADD COLUMN corrective_action VARCHAR(2000) NULL;
ALTER TABLE pek_report_exceedances ADD COLUMN due_date DATE NULL;
ALTER TABLE pek_report_exceedances ADD COLUMN completed_at DATETIME NULL;
ALTER TABLE pek_report_exceedances ADD COLUMN completed_by BIGINT NULL;
ALTER TABLE pek_report_exceedances ADD COLUMN resolution_comment VARCHAR(2000) NULL;

CREATE INDEX ix_pek_report_exceedances_due_date ON pek_report_exceedances (due_date);

-- Evidence files attached to an exceedance's corrective-action workflow (join table, mirrors
-- pek_program_documents's fileId-only pattern - never stores bytes here).
CREATE TABLE pek_exceedance_evidence_files (
    id BIGINT NOT NULL AUTO_INCREMENT,
    exceedance_id BIGINT NOT NULL,
    file_id VARCHAR(64) NOT NULL,
    uploaded_by BIGINT NOT NULL,
    uploaded_at DATETIME NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_pek_exceedance_evidence_files_exceedance_id ON pek_exceedance_evidence_files (exceedance_id);
