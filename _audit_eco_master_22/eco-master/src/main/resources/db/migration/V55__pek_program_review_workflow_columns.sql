-- PEK module, phase 1 (module spec §15): extends the program status machine from the vertical
-- slice's DRAFT/ACTIVE/ARCHIVED-only flow to the full DRAFT/UNDER_REVIEW/RETURNED/APPROVED/
-- ACTIVE/ARCHIVED review cycle. status VARCHAR(20) already fits every new value (UNDER_REVIEW is
-- the longest at 12 chars), so no column-width change is needed - only new columns.

ALTER TABLE pek_programs
    ADD COLUMN description VARCHAR(2000) NULL AFTER name,
    ADD COLUMN reviewer_user_id BIGINT NULL AFTER responsible_user_id,
    ADD COLUMN approver_user_id BIGINT NULL AFTER reviewer_user_id,
    ADD COLUMN submitted_at TIMESTAMP NULL AFTER approver_user_id,
    ADD COLUMN approved_at TIMESTAMP NULL AFTER submitted_at,
    ADD COLUMN activated_at TIMESTAMP NULL AFTER approved_at,
    ADD COLUMN archived_at TIMESTAMP NULL AFTER activated_at;

CREATE INDEX idx_pek_programs_reviewer ON pek_programs (reviewer_user_id);
CREATE INDEX idx_pek_programs_approver ON pek_programs (approver_user_id);
