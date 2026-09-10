-- DocumentVersionService.createVersion() computes version_number as
-- countByDocumentId(documentId) + 1 with no DB-level guard, so two concurrent uploads for the
-- same document can both compute the same next number and insert two "version 3" rows. Close
-- that race at the database level; the application-level increment stays as the normal path,
-- this constraint is the safety net.
ALTER TABLE document_flow_document_versions
    ADD CONSTRAINT uk_dfdv_document_version UNIQUE (document_id, version_number);
