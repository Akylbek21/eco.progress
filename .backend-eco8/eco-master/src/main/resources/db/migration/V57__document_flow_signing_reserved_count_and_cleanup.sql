-- Document-flow module, P0 fixes:
--
-- 1. reserved_signature_count backs the SIGNATURES_CREATED usage-quota fix (module spec §19):
--    SigningRouteService.prepareForSigning now reserves the route's required-signature count
--    exactly once (guarded by this column being NULL) instead of that upfront reservation being
--    doubled by a second per-signature reserve() call in SigningService (removed) - and
--    cancelSigning now releases this amount back if the route never completes.
ALTER TABLE document_flow_signing_routes
    ADD COLUMN reserved_signature_count INT NULL;

-- 2. Drop four tables confirmed dead (zero references anywhere in src/main/java) - all four were
--    explicitly documented in their own creating migrations as temporary merge-reconciliation
--    scaffolding to drop once the real schema landed, which it has (V38 document_flow_memberships,
--    V43 document_flow_documents/document_flow_document_versions, V41
--    document_flow_idempotency_requests):
--      - document_flow_temp_memberships (V43, "drop once Agent A's membership schema lands")
--      - document_flow_documents_signing_placeholder (V47, "DELETE ... at merge time")
--      - document_flow_document_versions_signing_placeholder (V47, "DELETE ... at merge time")
--      - document_flow_idempotency_keys (V46, "drop this table if Agent A's shared ... lands")
DROP TABLE IF EXISTS document_flow_temp_memberships;
DROP TABLE IF EXISTS document_flow_documents_signing_placeholder;
DROP TABLE IF EXISTS document_flow_document_versions_signing_placeholder;
DROP TABLE IF EXISTS document_flow_idempotency_keys;
