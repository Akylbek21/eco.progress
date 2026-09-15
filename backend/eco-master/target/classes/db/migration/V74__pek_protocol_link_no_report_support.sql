-- Support creating a protocol<->PEK link before a pek_reports row exists (e.g. from a control
-- event or monitoring point context, module spec's protocol-initiated flow) - report_id was
-- previously NOT NULL (V36), which only fit the report-driven collection flow. It must now be
-- optional; existing rows keep their real report_id untouched.
--
-- client_link_id backs client-supplied idempotency (module spec: "clientLinkId используется для
-- идемпотентности") - a unique index on (protocol_id, client_link_id) prevents a retried request
-- with the same key from ever creating a second row. MySQL treats every NULL in a unique index as
-- distinct from every other NULL, so rows without a client_link_id are unaffected by this
-- constraint (they rely on the existing report_id-based dedup checks in PekProtocolLinkService).

ALTER TABLE pek_report_protocol_sources
    MODIFY COLUMN report_id BIGINT NULL;

ALTER TABLE pek_report_protocol_sources
    ADD COLUMN client_link_id VARCHAR(100) NULL AFTER order_service_item_id;

CREATE UNIQUE INDEX uk_pek_rps_protocol_client_link
    ON pek_report_protocol_sources (protocol_id, client_link_id);
