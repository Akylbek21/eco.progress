-- PEK (производственный экологический контроль) module - first vertical slice: programs and
-- reports scoped to real company_objects rows, with reports linking real lab_protocols rows
-- (added pek_program_id/pek_report_id columns below). See kz.eco.pek package for the rest.

CREATE TABLE IF NOT EXISTS pek_programs (
    id BIGINT NOT NULL AUTO_INCREMENT,
    company_id BIGINT NOT NULL,
    object_id BIGINT NOT NULL,
    number VARCHAR(60) NOT NULL,
    name VARCHAR(255) NOT NULL,
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    responsible_user_id BIGINT,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_pek_programs_company FOREIGN KEY (company_id) REFERENCES companies (id),
    CONSTRAINT fk_pek_programs_object FOREIGN KEY (object_id) REFERENCES company_objects (id)
);

CREATE INDEX idx_pek_programs_object ON pek_programs (company_id, object_id);
CREATE INDEX idx_pek_programs_status ON pek_programs (status);

CREATE TABLE IF NOT EXISTS pek_reports (
    id BIGINT NOT NULL AUTO_INCREMENT,
    company_id BIGINT NOT NULL,
    object_id BIGINT NOT NULL,
    program_id BIGINT NOT NULL,
    period_type VARCHAR(10) NOT NULL,
    report_year INT NOT NULL,
    report_quarter INT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    responsible_user_id BIGINT,
    linked_protocol_count INT NOT NULL DEFAULT 0,
    last_collected_at TIMESTAMP NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_pek_report_period UNIQUE (object_id, program_id, period_type, report_year, report_quarter),
    CONSTRAINT fk_pek_reports_company FOREIGN KEY (company_id) REFERENCES companies (id),
    CONSTRAINT fk_pek_reports_object FOREIGN KEY (object_id) REFERENCES company_objects (id),
    CONSTRAINT fk_pek_reports_program FOREIGN KEY (program_id) REFERENCES pek_programs (id)
);

CREATE INDEX idx_pek_reports_object ON pek_reports (company_id, object_id);
CREATE INDEX idx_pek_reports_program ON pek_reports (program_id);
CREATE INDEX idx_pek_reports_status ON pek_reports (status);

ALTER TABLE lab_protocols ADD COLUMN pek_program_id BIGINT NULL;
ALTER TABLE lab_protocols ADD COLUMN pek_report_id BIGINT NULL;
CREATE INDEX idx_lab_protocols_pek_report ON lab_protocols (pek_report_id);
