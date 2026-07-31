-- Supporting indexes for the signing-module query patterns added in V47-V49:
--   * SigningRouteService.getDraftOrActiveRouteOrThrow: latest DRAFT/ACTIVE route per document.
--   * DocumentFlowSignatureRepository.findAllByDocumentId: signed-package/verify-all/report.
--   * Reserved: this is the last migration number in this agent's assigned range (V47-V50) -
--     any further document-flow-signing schema change belongs in a later, newly-numbered
--     migration once the overall V-number ranges across agents are reconciled at merge time.

CREATE INDEX idx_document_flow_signatures_document_signed_at
    ON document_flow_signatures (document_id, signed_at);

CREATE INDEX idx_document_flow_signing_assignments_status
    ON document_flow_signing_assignments (status);
