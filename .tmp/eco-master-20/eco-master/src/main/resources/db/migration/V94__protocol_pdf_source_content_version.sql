-- Protocol.pdfSourceContentVersion: the contentVersion a generated PDF was rendered from, so
-- sign() can reject a PDF that no longer reflects the protocol's current content (409
-- DOCUMENT_OUTDATED) instead of signing stale data.
ALTER TABLE lab_protocols ADD COLUMN pdf_source_content_version BIGINT NULL;
