-- PekReport.contentRevision: distinct from the JPA @Version column - bumped explicitly whenever
-- any report-affecting sub-resource changes (protocol sources, plan/fact, exceedances/evidence,
-- permits, monitoring), not just when the pek_reports row itself is directly updated. This is
-- what generated documents/packages are actually checked against for staleness, not report.version.
ALTER TABLE pek_reports ADD COLUMN content_revision BIGINT NOT NULL DEFAULT 0;

-- Renamed from source_report_version: both columns already stored a report.version snapshot at
-- generation time, but the comparison must move to contentRevision, not JPA version - rename for
-- honesty rather than leaving a misleadingly-named column with new semantics.
ALTER TABLE pek_report_document_versions CHANGE COLUMN source_report_version source_content_revision BIGINT NULL;
ALTER TABLE pek_report_packages CHANGE COLUMN source_report_version source_content_revision BIGINT NOT NULL;
