-- Task 3: real submission lifecycle fields and SUBMITTED/ACCEPTED/REJECTED status support.
-- The status column is VARCHAR so no enum-type migration is needed - Hibernate maps Java enum
-- values to their name() strings, and the new values simply start being stored once the
-- application code writes them. Existing rows remain SIGNED/ARCHIVED etc unchanged.

-- submissionDueDate is computed once at report creation from periodType+periodEnd per Правила №250
-- §16: quarterly = periodEnd + 30 days, annual = periodEnd + 45 days. Deliberately independent of
-- periodEnd itself and program.validUntil.
ALTER TABLE pek_reports ADD COLUMN submission_due_date DATE;

-- Timestamp for each submission lifecycle transition (only set when the transition actually occurs).
ALTER TABLE pek_reports ADD COLUMN submitted_at TIMESTAMP;
ALTER TABLE pek_reports ADD COLUMN accepted_at TIMESTAMP;
ALTER TABLE pek_reports ADD COLUMN rejected_at TIMESTAMP;

-- Mandatory reason from the regulatory authority when the submission is rejected.
ALTER TABLE pek_reports ADD COLUMN rejection_reason VARCHAR(2000);
