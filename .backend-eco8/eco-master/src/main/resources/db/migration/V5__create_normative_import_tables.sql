-- Pollutants registry
CREATE TABLE IF NOT EXISTS pollutants (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    name_ru VARCHAR(300),
    name_kz VARCHAR(300),
    aliases VARCHAR(500),
    cas_number VARCHAR(40),
    chemical_formula VARCHAR(80),
    hazard_class VARCHAR(10),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pollutant_code (code)
);

-- Normative records (imported from Excel)
CREATE TABLE IF NOT EXISTS normative_records (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pollutant_id BIGINT,
    pollutant_code VARCHAR(20),
    indicator_name_ru VARCHAR(300),
    indicator_name_kz VARCHAR(300),
    template_type VARCHAR(30),
    environment_type VARCHAR(30),
    normative_type VARCHAR(30),
    normative_sub_type VARCHAR(60),
    unit VARCHAR(40),
    norm_value DECIMAL(20,6),
    min_value DECIMAL(20,6),
    max_value DECIMAL(20,6),
    comparison_type VARCHAR(30),
    hazard_class VARCHAR(10),
    normative_document VARCHAR(300),
    document_number VARCHAR(80),
    document_date DATE,
    effective_from DATE,
    effective_to DATE,
    version INT NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    source_file VARCHAR(200),
    source_row_number INT,
    source_raw_value VARCHAR(200),
    cas_number VARCHAR(80),
    chemical_formula VARCHAR(80),
    import_batch_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_nr_pollutant_code (pollutant_code),
    INDEX idx_nr_env_type (environment_type),
    INDEX idx_nr_active (active)
);

-- Summation groups
CREATE TABLE IF NOT EXISTS summation_groups (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    group_code VARCHAR(20) NOT NULL,
    group_name VARCHAR(500),
    pollutant_codes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    source_file VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Pollutant code groups
CREATE TABLE IF NOT EXISTS pollutant_code_groups (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    group_code VARCHAR(20) NOT NULL,
    group_name VARCHAR(300),
    code_from VARCHAR(20),
    code_to VARCHAR(20),
    description VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    source_file VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Import batches tracking
CREATE TABLE IF NOT EXISTS normative_import_batches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(200) NOT NULL,
    status VARCHAR(30),
    total_rows INT DEFAULT 0,
    valid_rows INT DEFAULT 0,
    error_rows INT DEFAULT 0,
    duplicates INT DEFAULT 0,
    new_pollutants INT DEFAULT 0,
    new_normatives INT DEFAULT 0,
    updated_normatives INT DEFAULT 0,
    errors_json TEXT,
    user_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP
);
