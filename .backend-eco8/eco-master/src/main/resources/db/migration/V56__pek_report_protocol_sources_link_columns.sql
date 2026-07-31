-- PEK module, phase 1 (module spec §5): pek_report_protocol_sources is the ONE canonical link
-- table between protocols and PEK programs/reports/control-items (see Protocol.java's updated
-- javadoc - the legacy lab_protocols.pek_* soft-link columns from V53 stay permanently unpopulated
-- and are not written by any code path). This migration adds the remaining columns the canonical
-- schema needs: program_id (denormalized from report_id, avoids a join to filter by program),
-- control_item_id (which plan position this link satisfies - required for plan/fact, §11),
-- the four soft-link point identifiers from the spec's link-table schema, plus match_type/
-- match_score/matched_by/source_version bookkeeping and, finally, optimistic-lock version.
--
-- Real DB-level duplicate protection for the "protocol_result_id IS NULL" case (MySQL treats every
-- NULL in a unique index as distinct from every other NULL, so the existing
-- uk_pek_report_protocol_source constraint from V36 does not actually stop two concurrent
-- whole-protocol-match inserts): protocol_result_key is a generated column that collapses NULL to
-- 0, and the new unique index is on that instead.

ALTER TABLE pek_report_protocol_sources
    ADD COLUMN program_id BIGINT NULL AFTER report_id,
    ADD COLUMN control_item_id BIGINT NULL AFTER protocol_result_id,
    ADD COLUMN control_event_id BIGINT NULL AFTER control_item_id,
    ADD COLUMN monitoring_point_id BIGINT NULL AFTER control_event_id,
    ADD COLUMN emission_source_id BIGINT NULL AFTER monitoring_point_id,
    ADD COLUMN water_outlet_id BIGINT NULL AFTER emission_source_id,
    ADD COLUMN waste_source_id BIGINT NULL AFTER water_outlet_id,
    ADD COLUMN match_type VARCHAR(20) NOT NULL DEFAULT 'AUTO' AFTER match_status,
    ADD COLUMN match_score DECIMAL(5,2) NULL AFTER match_type,
    ADD COLUMN matched_by BIGINT NULL AFTER matched_at,
    ADD COLUMN source_version BIGINT NULL AFTER matched_by,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0 AFTER created_at,
    ADD COLUMN protocol_result_key BIGINT GENERATED ALWAYS AS (COALESCE(protocol_result_id, 0)) STORED;

UPDATE pek_report_protocol_sources s
    JOIN pek_reports r ON r.id = s.report_id
    SET s.program_id = r.program_id
    WHERE s.program_id IS NULL;

CREATE UNIQUE INDEX uk_pek_report_protocol_source_real ON pek_report_protocol_sources
    (report_id, protocol_id, protocol_result_key);

CREATE INDEX idx_pek_report_protocol_sources_program ON pek_report_protocol_sources (program_id);
CREATE INDEX idx_pek_report_protocol_sources_control_item ON pek_report_protocol_sources (control_item_id);

ALTER TABLE pek_report_protocol_sources
    ADD CONSTRAINT fk_pek_sources_control_item FOREIGN KEY (control_item_id) REFERENCES pek_program_control_items (id);
