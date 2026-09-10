-- Task 1: split OFFICIAL vs INTERNAL document types in pek_report_document_versions.
-- Task 2: stamp regulationVersion/templateVersion on pek_report_document_versions and pek_reports
--         so each generated document version carries its own immutable normative-basis reference.

-- Document-level type discriminator (OFFICIAL = state-facing normative template,
-- INTERNAL = CRM analytical, not for submission).
ALTER TABLE pek_report_document_versions
    ADD COLUMN document_type VARCHAR(20) NOT NULL DEFAULT 'OFFICIAL';

-- Regulation/template versions stamped at generation time and immutable per version row.
ALTER TABLE pek_report_document_versions
    ADD COLUMN regulation_version VARCHAR(120) NOT NULL DEFAULT 'Правила №250 (Приказ МЭГПР РК от 26.05.2023 №250)';

ALTER TABLE pek_report_document_versions
    ADD COLUMN template_version VARCHAR(40) NOT NULL DEFAULT 'v1-legacy';

-- Report-level: regulation/template version copied from the program at report creation time and
-- frozen - never updated even if the program is later superseded.
ALTER TABLE pek_reports
    ADD COLUMN regulation_version VARCHAR(120) NOT NULL DEFAULT 'Правила №250 (Приказ МЭГПР РК от 26.05.2023 №250)';

ALTER TABLE pek_reports
    ADD COLUMN template_version VARCHAR(40) NOT NULL DEFAULT 'v1-legacy';
