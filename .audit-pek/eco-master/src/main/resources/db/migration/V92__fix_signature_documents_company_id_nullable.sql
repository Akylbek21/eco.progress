-- Second safety net after V88/V90: some environments' signature_documents.company_id is still
-- NOT NULL (e.g. V82's original DDL applied without V88/V90 ever landing on that database), so
-- every upload's INSERT fails with a 409 since SignatureDocumentService#upload never sets
-- company_id anymore. Idempotent - MODIFY COLUMN to the same nullability is a no-op where V88/V90
-- already applied cleanly.
ALTER TABLE signature_documents MODIFY COLUMN company_id BIGINT NULL;
