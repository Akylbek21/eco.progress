CREATE TABLE pek_report_workflow_history (
    id BIGINT NOT NULL AUTO_INCREMENT,
    report_id BIGINT NOT NULL,
    from_status VARCHAR(30) NULL,
    to_status VARCHAR(30) NULL,
    action VARCHAR(40) NOT NULL,
    comment VARCHAR(2000) NULL,
    performed_by BIGINT NOT NULL,
    performed_at TIMESTAMP NOT NULL,
    version_before BIGINT NULL,
    version_after BIGINT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_pek_report_history_report FOREIGN KEY (report_id) REFERENCES pek_reports(id),
    CONSTRAINT fk_pek_report_history_user FOREIGN KEY (performed_by) REFERENCES users(id)
);
CREATE INDEX idx_pek_report_history_report_time ON pek_report_workflow_history(report_id, performed_at);
