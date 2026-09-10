-- Replaces the pek_program_id/pek_report_id columns added on lab_protocols by V35 with a proper
-- join table. Those two nullable FK columns on lab_protocols could only ever point a protocol at
-- ONE report at a time, which cannot model the real requirement: one protocol must be able to
-- belong to a quarterly report AND a yearly report AND a later corrective revision simultaneously.
-- See kz.eco.pek.PekReportProtocolSource / PekReportCollectionService for the new design.

CREATE TABLE IF NOT EXISTS pek_report_protocol_sources (
    id BIGINT NOT NULL AUTO_INCREMENT,
    report_id BIGINT NOT NULL,
    protocol_id BIGINT NOT NULL,
    -- NULL = whole protocol matched (the only kind PekReportCollectionService produces today);
    -- non-null narrows the link to one specific protocol_results row for future finer-grained
    -- matching. NOTE: MySQL treats every NULL in a unique index as distinct from every other NULL,
    -- so this constraint alone does NOT stop two concurrent whole-protocol links for the same
    -- (report_id, protocol_id) pair - the application-level existence check in
    -- PekReportProtocolSourceRepository#existsByReportIdAndProtocolIdAndProtocolResultIdIsNull
    -- compensates for that gap.
    protocol_result_id BIGINT NULL,
    match_status VARCHAR(20) NOT NULL DEFAULT 'MATCHED',
    source_value VARCHAR(255) NULL,
    normalized_value VARCHAR(255) NULL,
    manual TINYINT(1) NOT NULL DEFAULT 0,
    excluded TINYINT(1) NOT NULL DEFAULT 0,
    exclusion_reason VARCHAR(500) NULL,
    matched_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_pek_report_protocol_source UNIQUE (report_id, protocol_id, protocol_result_id),
    CONSTRAINT fk_pek_rps_report FOREIGN KEY (report_id) REFERENCES pek_reports (id),
    CONSTRAINT fk_pek_rps_protocol FOREIGN KEY (protocol_id) REFERENCES lab_protocols (id)
);

CREATE INDEX idx_pek_rps_report ON pek_report_protocol_sources (report_id);
CREATE INDEX idx_pek_rps_protocol ON pek_report_protocol_sources (protocol_id);

-- Migrate any existing links created by the old FK-column design (V35) into the new join table,
-- guarded so this also runs cleanly on a fresh DB where lab_protocols has no matching rows yet
-- (the INSERT ... SELECT is naturally a no-op when the WHERE clause matches nothing).
INSERT INTO pek_report_protocol_sources (report_id, protocol_id, match_status, matched_at, created_at)
SELECT pek_report_id, id, 'MATCHED', NOW(), NOW()
FROM lab_protocols
WHERE pek_report_id IS NOT NULL;

-- MySQL 8.4 (this project's target, see docker-compose.yml) supports IF EXISTS on
-- ALTER TABLE ... DROP COLUMN (added in 8.0.29), so no stored-procedure existence-check idiom
-- (like eco_v33_create_index_if_missing in V33) is needed here.
ALTER TABLE lab_protocols DROP COLUMN IF EXISTS pek_program_id;
ALTER TABLE lab_protocols DROP COLUMN IF EXISTS pek_report_id;
