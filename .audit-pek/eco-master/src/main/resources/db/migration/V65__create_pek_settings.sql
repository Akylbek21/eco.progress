CREATE TABLE pek_settings (
    id BIGINT NOT NULL AUTO_INCREMENT,
    company_id BIGINT NOT NULL,
    default_responsible_user_id BIGINT NULL,
    default_laboratory_id BIGINT NULL,
    default_report_type VARCHAR(20) NOT NULL DEFAULT 'QUARTERLY',
    auto_collect_protocols BOOLEAN NOT NULL DEFAULT FALSE,
    include_only_signed_protocols BOOLEAN NOT NULL DEFAULT TRUE,
    allow_fallback_matching BOOLEAN NOT NULL DEFAULT TRUE,
    require_manual_ambiguous_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
    require_all_plan_fact_items BOOLEAN NOT NULL DEFAULT TRUE,
    block_submit_with_unmatched_results BOOLEAN NOT NULL DEFAULT TRUE,
    block_submit_with_ambiguous_results BOOLEAN NOT NULL DEFAULT TRUE,
    block_submit_with_stale_sources BOOLEAN NOT NULL DEFAULT TRUE,
    block_submit_with_open_exceedances BOOLEAN NOT NULL DEFAULT TRUE,
    notify_before_deadline_days INT NOT NULL DEFAULT 7,
    notify_missing_protocols BOOLEAN NOT NULL DEFAULT TRUE,
    notify_exceedances BOOLEAN NOT NULL DEFAULT TRUE,
    notify_report_returned BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    created_by BIGINT NOT NULL,
    updated_by BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_pek_settings_company UNIQUE (company_id),
    CONSTRAINT fk_pek_settings_company FOREIGN KEY (company_id) REFERENCES companies (id),
    CONSTRAINT fk_pek_settings_responsible FOREIGN KEY (default_responsible_user_id) REFERENCES users (id),
    CONSTRAINT fk_pek_settings_laboratory FOREIGN KEY (default_laboratory_id) REFERENCES laboratories (id),
    CONSTRAINT fk_pek_settings_created_by FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT fk_pek_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users (id)
);

CREATE INDEX idx_pek_settings_responsible ON pek_settings (default_responsible_user_id);
CREATE INDEX idx_pek_settings_laboratory ON pek_settings (default_laboratory_id);

-- Rollback is intentionally manual: DROP TABLE pek_settings. No existing data is modified.
