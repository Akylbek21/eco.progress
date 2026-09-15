-- Plan/fact and exceedance calculation for PEK reports (module spec §6/§14). Previously
-- pek_report_protocol_sources only ever linked a whole Protocol to a report (protocol_result_id
-- always NULL - see PekReportCollectionService's javadoc) - real plan/fact needs per-indicator
-- granularity, so this adds program_indicator_id and lets collect() also create one row per
-- ProtocolResult that unambiguously matches a program indicator (protocol_result_id set on those
-- rows, distinct from the existing whole-protocol row per the V56 unique index).

ALTER TABLE pek_report_protocol_sources
    ADD COLUMN program_indicator_id BIGINT NULL AFTER control_item_id;

CREATE INDEX idx_pek_report_protocol_sources_indicator ON pek_report_protocol_sources (program_indicator_id);

ALTER TABLE pek_report_protocol_sources
    ADD CONSTRAINT fk_pek_sources_indicator FOREIGN KEY (program_indicator_id) REFERENCES pek_program_indicators (id);

-- One row per (report, program indicator): the computed plan/fact position, recomputed in place on
-- every collect()/plan-fact recalculation (module spec §2.6) - never delete-then-reinsert, the row
-- keeps a stable id across recomputes exactly like PekProgramService's control-item reconciliation.
CREATE TABLE pek_report_plan_fact_rows (
    id BIGINT NOT NULL AUTO_INCREMENT,
    report_id BIGINT NOT NULL,
    control_item_id BIGINT NOT NULL,
    program_indicator_id BIGINT NOT NULL,
    planned_count INT NOT NULL DEFAULT 0,
    actual_count INT NOT NULL DEFAULT 0,
    missing_count INT NOT NULL DEFAULT 0,
    completion_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL,
    normative_value DECIMAL(18,6) NULL,
    comparison_type VARCHAR(20) NULL,
    best_value DECIMAL(18,6) NULL,
    worst_value DECIMAL(18,6) NULL,
    average_value DECIMAL(18,6) NULL,
    has_exceedance BOOLEAN NOT NULL DEFAULT FALSE,
    exceedance_count INT NOT NULL DEFAULT 0,
    manual_status VARCHAR(30) NULL,
    manual_reason VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_pek_plan_fact_row UNIQUE (report_id, program_indicator_id),
    CONSTRAINT fk_pek_plan_fact_report FOREIGN KEY (report_id) REFERENCES pek_reports (id),
    CONSTRAINT fk_pek_plan_fact_control_item FOREIGN KEY (control_item_id) REFERENCES pek_program_control_items (id),
    CONSTRAINT fk_pek_plan_fact_indicator FOREIGN KEY (program_indicator_id) REFERENCES pek_program_indicators (id)
);

CREATE INDEX idx_pek_plan_fact_rows_report ON pek_report_plan_fact_rows (report_id);

-- One row per genuinely exceeded measurement (module spec §14) - recomputed alongside the owning
-- plan/fact row; a measurement that stops exceeding on recompute has its row deleted (deliberately
-- not soft-deleted - an exceedance that never happened should leave no confusing residue), matching
-- the reconciliation style used everywhere else in this module.
CREATE TABLE pek_report_exceedances (
    id BIGINT NOT NULL AUTO_INCREMENT,
    report_id BIGINT NOT NULL,
    plan_fact_row_id BIGINT NOT NULL,
    protocol_id BIGINT NOT NULL,
    protocol_result_id BIGINT NOT NULL,
    program_indicator_id BIGINT NOT NULL,
    actual_value DECIMAL(18,6) NOT NULL,
    normative_value DECIMAL(18,6) NOT NULL,
    comparison_type VARCHAR(20) NOT NULL,
    exceedance_ratio DECIMAL(10,4) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    comment VARCHAR(1000) NULL,
    resolved_at TIMESTAMP NULL,
    resolved_by BIGINT NULL,
    resolution VARCHAR(1000) NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_pek_exceedance UNIQUE (report_id, protocol_result_id),
    CONSTRAINT fk_pek_exceedance_report FOREIGN KEY (report_id) REFERENCES pek_reports (id),
    CONSTRAINT fk_pek_exceedance_plan_fact_row FOREIGN KEY (plan_fact_row_id) REFERENCES pek_report_plan_fact_rows (id)
);

CREATE INDEX idx_pek_report_exceedances_report_status ON pek_report_exceedances (report_id, status);
