-- FileTypeMapping.sourceDocumentCode() was missing a case for TemplateType.WATER_WASTEWATER, so
-- every water normative imported before this fix was saved with a NULL source_document_code
-- instead of DSM_138. Backfill only the rows that are actually missing it - never touch a row
-- where a value is already set (e.g. a differently-sourced water record imported some other way).
UPDATE normative_records
SET source_document_code = 'DSM_138'
WHERE template_type = 'WATER_WASTEWATER'
  AND (source_document_code IS NULL OR source_document_code = '');
