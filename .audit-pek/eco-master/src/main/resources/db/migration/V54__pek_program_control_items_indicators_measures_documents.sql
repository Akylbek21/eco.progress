-- PEK module, phase 1 (module spec §6.2-§6.5): control items, indicators, measures and documents
-- under a pek_programs row - the actual monitoring plan content that the first vertical slice
-- (V35/V36/V52/V53) never modeled, only the program header itself.

CREATE TABLE pek_program_control_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    program_id BIGINT NOT NULL,
    code VARCHAR(60) NOT NULL,
    name VARCHAR(255) NOT NULL,
    section_code VARCHAR(40),
    control_type VARCHAR(30) NOT NULL,
    environment_component VARCHAR(60),
    monitoring_point_id BIGINT,
    emission_source_id BIGINT,
    water_outlet_id BIGINT,
    waste_source_id BIGINT,
    laboratory_id BIGINT,
    frequency_type VARCHAR(20) NOT NULL,
    frequency_value INT NOT NULL DEFAULT 1,
    planned_count INT,
    measurement_method VARCHAR(255),
    sampling_method VARCHAR(255),
    start_date DATE,
    end_date DATE,
    responsible_user_id BIGINT,
    is_mandatory TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_pek_control_items_program FOREIGN KEY (program_id) REFERENCES pek_programs (id),
    CONSTRAINT fk_pek_control_items_laboratory FOREIGN KEY (laboratory_id) REFERENCES laboratories (id)
);

CREATE INDEX idx_pek_control_items_program ON pek_program_control_items (program_id);
CREATE INDEX idx_pek_control_items_laboratory ON pek_program_control_items (laboratory_id);

CREATE TABLE pek_program_indicators (
    id BIGINT NOT NULL AUTO_INCREMENT,
    program_id BIGINT NOT NULL,
    control_item_id BIGINT NOT NULL,
    indicator_id BIGINT,
    indicator_code VARCHAR(60),
    indicator_name VARCHAR(255) NOT NULL,
    unit VARCHAR(40),
    normative_id BIGINT,
    normative_value DECIMAL(18,6),
    comparison_type VARCHAR(20),
    min_value DECIMAL(18,6),
    max_value DECIMAL(18,6),
    methodology_id BIGINT,
    measurement_device_type VARCHAR(120),
    is_mandatory TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_pek_indicators_program FOREIGN KEY (program_id) REFERENCES pek_programs (id),
    CONSTRAINT fk_pek_indicators_control_item FOREIGN KEY (control_item_id) REFERENCES pek_program_control_items (id)
);

CREATE INDEX idx_pek_indicators_program ON pek_program_indicators (program_id);
CREATE INDEX idx_pek_indicators_control_item ON pek_program_indicators (control_item_id);

CREATE TABLE pek_program_measures (
    id BIGINT NOT NULL AUTO_INCREMENT,
    program_id BIGINT NOT NULL,
    code VARCHAR(60) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(2000),
    planned_start_date DATE,
    planned_end_date DATE,
    responsible_user_id BIGINT,
    planned_budget DECIMAL(18,2),
    currency VARCHAR(3),
    status VARCHAR(20) NOT NULL,
    completion_percent INT NOT NULL DEFAULT 0,
    result_description VARCHAR(2000),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_pek_measures_program FOREIGN KEY (program_id) REFERENCES pek_programs (id)
);

CREATE INDEX idx_pek_measures_program ON pek_program_measures (program_id);
CREATE INDEX idx_pek_measures_status ON pek_program_measures (status);

CREATE TABLE pek_program_documents (
    id BIGINT NOT NULL AUTO_INCREMENT,
    program_id BIGINT NOT NULL,
    file_id VARCHAR(64) NOT NULL,
    document_type VARCHAR(60),
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(120),
    size BIGINT NOT NULL DEFAULT 0,
    sha256 VARCHAR(64),
    uploaded_by BIGINT NOT NULL,
    uploaded_at TIMESTAMP NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_pek_documents_program FOREIGN KEY (program_id) REFERENCES pek_programs (id)
);

CREATE INDEX idx_pek_documents_program ON pek_program_documents (program_id);
