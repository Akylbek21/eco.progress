-- PekReportDocumentVersion.sourceReportVersion: which PekReport.version a generated DOCX/PDF was
-- rendered from, so the sign endpoint can reject a document that has gone stale since generation.
ALTER TABLE pek_report_document_versions ADD COLUMN source_report_version BIGINT NULL;
