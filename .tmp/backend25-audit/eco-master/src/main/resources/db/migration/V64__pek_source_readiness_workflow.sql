-- Additive PEK source reconciliation metadata. Existing rows remain valid; nullable reason is
-- intentionally not backfilled because historical automatic matches have no trustworthy reason.
ALTER TABLE pek_report_protocol_sources
    ADD COLUMN match_reason VARCHAR(1000) NULL,
    ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX idx_pek_rps_report_result_status
    ON pek_report_protocol_sources (report_id, match_status, protocol_result_id);

-- Rollback (manual): DROP INDEX idx_pek_rps_report_result_status ON pek_report_protocol_sources;
-- ALTER TABLE pek_report_protocol_sources DROP COLUMN updated_at, DROP COLUMN match_reason;
