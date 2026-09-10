-- Blocker 1: race-safe "one draft protocol per PEK requirement".
--
-- POST /api/protocols/from-pek creates a DRAFT protocol for exactly one PEK requirement, where a
-- requirement is identified by (program, monitoring direction, control item, monitoring point,
-- reporting period). A find-then-save duplicate check cannot close the window between two
-- concurrent requests, so the requirement identity is materialized into a single column with a
-- real unique index; the service catches DataIntegrityViolationException and converts it into the
-- stable error code PROTOCOL_DRAFT_ALREADY_EXISTS (carrying the winner's protocol id).
--
-- Value shape (see PekReportProtocolSource.requirementKey):
--   program:<id>|monitoring:<id|->|item:<id|->|point:<id|->|period:<YYYY-Qn>
--
-- NULL for every pre-existing row and for links created by any other flow (auto collection,
-- manual linking) - MySQL treats each NULL in a unique index as distinct, so existing rows and
-- non-from-PEK links are entirely unaffected by this constraint.

ALTER TABLE pek_report_protocol_sources
    ADD COLUMN requirement_key VARCHAR(190) NULL AFTER client_link_id;

CREATE UNIQUE INDEX uk_pek_rps_requirement
    ON pek_report_protocol_sources (requirement_key);

-- Blocker 2 needs no schema change: program_indicator_id (plus its index and FK) already exists
-- on this table since V59. It is now also written by the protocol-initiated link flow instead of
-- only by report-time collection.
