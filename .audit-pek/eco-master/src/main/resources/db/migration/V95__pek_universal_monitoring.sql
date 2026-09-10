-- Universal monitoring directions inside one PEK program. Existing control items remain intact;
-- links are nullable/additive and can be backfilled explicitly without guessing a component.
CREATE TABLE pek_program_monitoring (
    id BIGINT NOT NULL AUTO_INCREMENT,
    program_id BIGINT NOT NULL,
    monitoring_type VARCHAR(30) NOT NULL,
    name VARCHAR(255), methodology VARCHAR(1000), laboratory_id BIGINT,
    frequency_type VARCHAR(20), planned_count INT,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_pek_monitoring_program FOREIGN KEY (program_id) REFERENCES pek_programs(id),
    CONSTRAINT fk_pek_monitoring_laboratory FOREIGN KEY (laboratory_id) REFERENCES laboratories(id),
    CONSTRAINT uk_pek_program_monitoring_type UNIQUE (program_id, monitoring_type)
);
CREATE INDEX idx_pek_monitoring_program_active ON pek_program_monitoring(program_id, active);

CREATE TABLE pek_monitoring_control_items (
    monitoring_id BIGINT NOT NULL, control_item_id BIGINT NOT NULL,
    PRIMARY KEY (monitoring_id, control_item_id),
    CONSTRAINT fk_pek_monitoring_items_monitoring FOREIGN KEY (monitoring_id) REFERENCES pek_program_monitoring(id),
    CONSTRAINT fk_pek_monitoring_items_item FOREIGN KEY (control_item_id) REFERENCES pek_program_control_items(id)
);
CREATE INDEX idx_pek_monitoring_items_item ON pek_monitoring_control_items(control_item_id);

CREATE TABLE pek_report_packages (
    id BIGINT NOT NULL AUTO_INCREMENT, report_id BIGINT NOT NULL, document_version INT NOT NULL,
    source_report_version BIGINT NOT NULL, snapshot_json LONGTEXT NOT NULL, missing_fields_json LONGTEXT NOT NULL,
    zip_file_id VARCHAR(64), generated_at TIMESTAMP NOT NULL, generated_by BIGINT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY(id),
    CONSTRAINT fk_pek_report_package_report FOREIGN KEY(report_id) REFERENCES pek_reports(id),
    CONSTRAINT uk_pek_report_package_version UNIQUE(report_id, document_version)
);
CREATE INDEX idx_pek_report_package_report ON pek_report_packages(report_id, document_version);

-- Rollback: drop pek_report_packages, pek_monitoring_control_items, then pek_program_monitoring.
-- No legacy PEK or Protocol data is modified or deleted by this migration.
