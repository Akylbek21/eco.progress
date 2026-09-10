ALTER TABLE pek_reports ADD COLUMN return_reason VARCHAR(2000) NULL;
ALTER TABLE pek_reports ADD COLUMN returned_at TIMESTAMP NULL;
ALTER TABLE pek_reports ADD COLUMN returned_by_user_id BIGINT NULL;

CREATE INDEX idx_pek_reports_returned_by ON pek_reports (returned_by_user_id);
ALTER TABLE pek_reports ADD CONSTRAINT fk_pek_reports_returned_by
    FOREIGN KEY (returned_by_user_id) REFERENCES users (id);
