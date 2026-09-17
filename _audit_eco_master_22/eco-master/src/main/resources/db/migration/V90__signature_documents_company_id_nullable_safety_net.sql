-- Safety net for V88__signature_documents_company_id_optional.sql: re-asserts company_id as
-- nullable. Idempotent (MODIFY COLUMN to the same nullability is a no-op) - guards against any
-- environment where V88 was, for whatever reason, never actually applied to signature_documents,
-- which would otherwise make every upload fail its INSERT since the application code never sets
-- company_id anymore (see kz.eco.signaturedoc.SignatureDocumentService#upload).
ALTER TABLE signature_documents MODIFY COLUMN company_id BIGINT NULL;
