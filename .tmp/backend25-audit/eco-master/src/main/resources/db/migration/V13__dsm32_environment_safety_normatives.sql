ALTER TABLE normative_records ADD COLUMN matrix_type VARCHAR(80);
ALTER TABLE normative_records ADD COLUMN assessment_category VARCHAR(120);
ALTER TABLE normative_records ADD COLUMN pollution_degree VARCHAR(120);
ALTER TABLE normative_records ADD COLUMN form_type VARCHAR(120);

CREATE INDEX idx_nr_matrix_type ON normative_records (matrix_type);
CREATE INDEX idx_nr_form_type ON normative_records (form_type);
CREATE INDEX idx_nr_assessment_category ON normative_records (assessment_category);
