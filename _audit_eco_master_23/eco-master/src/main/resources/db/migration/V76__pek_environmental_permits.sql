-- Real environmental permit records (Iteration 2 of the PEK module overhaul), replacing
-- PekLookupService#permitsForObject's previously hardcoded empty list. Starts empty - no existing
-- table in this schema holds permit data to backfill from.
CREATE TABLE pek_environmental_permits (
    id BIGINT NOT NULL AUTO_INCREMENT,
    company_id BIGINT NOT NULL,
    object_id BIGINT NOT NULL,
    type VARCHAR(60) NOT NULL,
    number VARCHAR(100) NOT NULL,
    issued_at DATE NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    authority VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    file_id VARCHAR(64) NULL,
    note VARCHAR(1000) NULL,
    pek_program_id BIGINT NULL,
    created_at DATETIME NOT NULL,
    created_by BIGINT NOT NULL,
    updated_at DATETIME NOT NULL,
    updated_by BIGINT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_pek_environmental_permits_object_id ON pek_environmental_permits (object_id);
CREATE INDEX ix_pek_environmental_permits_company_id ON pek_environmental_permits (company_id);
CREATE INDEX ix_pek_environmental_permits_program_id ON pek_environmental_permits (pek_program_id);

-- Append-only audit trail of permit status changes (mirrors pek_report_workflow_history's shape).
CREATE TABLE pek_permit_history (
    id BIGINT NOT NULL AUTO_INCREMENT,
    permit_id BIGINT NOT NULL,
    from_status VARCHAR(20) NULL,
    to_status VARCHAR(20) NOT NULL,
    comment VARCHAR(1000) NULL,
    performed_by BIGINT NOT NULL,
    performed_at DATETIME NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX ix_pek_permit_history_permit_id ON pek_permit_history (permit_id, performed_at);
