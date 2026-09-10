-- Certificate hardening (module: Подписание документов, item 5): record the outcome of each of
-- the four checks (chain/CRL/OCSP/TSA) run at signing time, not just the crypto verification
-- already covered by verification_status. Nullable - existing rows predate this feature and have
-- no meaningful value to backfill.
ALTER TABLE signature_document_signatures ADD COLUMN chain_status VARCHAR(20) NULL;
ALTER TABLE signature_document_signatures ADD COLUMN crl_status VARCHAR(20) NULL;
ALTER TABLE signature_document_signatures ADD COLUMN ocsp_status VARCHAR(20) NULL;
ALTER TABLE signature_document_signatures ADD COLUMN tsa_status VARCHAR(20) NULL;
