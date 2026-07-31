-- pek_reports.uk_pek_report_period includes nullable report_quarter, which MySQL treats as
-- distinct-per-NULL in a unique index - it does NOT actually prevent two YEAR reports
-- (report_quarter=NULL) for the same (object,program,year) at the database level; only the
-- application-level pre-check in PekReportService.create() closes that gap today, which is a
-- race under concurrent requests. Add a non-nullable period_key column that always has a real
-- value ("2026-YEAR" / "2026-Q1"..."2026-Q4") and switch the unique constraint to use it.

ALTER TABLE pek_reports ADD COLUMN period_key VARCHAR(20) NULL;

UPDATE pek_reports
SET period_key = CASE
    WHEN period_type = 'YEAR' THEN CONCAT(report_year, '-YEAR')
    ELSE CONCAT(report_year, '-Q', report_quarter)
END;

ALTER TABLE pek_reports MODIFY COLUMN period_key VARCHAR(20) NOT NULL;

ALTER TABLE pek_reports DROP CONSTRAINT uk_pek_report_period;
ALTER TABLE pek_reports ADD CONSTRAINT uk_pek_report_period UNIQUE (object_id, program_id, period_key);

CREATE INDEX idx_pek_reports_period_key ON pek_reports (period_key);
