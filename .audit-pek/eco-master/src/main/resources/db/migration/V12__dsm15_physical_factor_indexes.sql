ALTER TABLE normative_records MODIFY COLUMN factor_type VARCHAR(60);
ALTER TABLE normative_records MODIFY COLUMN factor_code VARCHAR(100);
ALTER TABLE normative_records MODIFY COLUMN room_type VARCHAR(100);

CREATE INDEX idx_normative_physical_factor ON normative_records (source_document_code, factor_type, factor_code);
CREATE INDEX idx_normative_physical_conditions ON normative_records (
    source_document_code, appendix_no, table_no, season, work_category, workplace_type, norm_level
);
