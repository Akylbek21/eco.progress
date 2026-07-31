-- Method templates
CREATE TABLE IF NOT EXISTS protocol_method_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    protocol_template_code VARCHAR(60),
    pollutant_code VARCHAR(64),
    pollutant_name VARCHAR(200),
    method_document VARCHAR(300),
    measurement_unit VARCHAR(40),
    result_unit VARCHAR(40),
    formula_expression TEXT,
    decimal_places INT NOT NULL DEFAULT 3,
    rounding_mode VARCHAR(20) NOT NULL DEFAULT 'HALF_UP',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mt_template_code (protocol_template_code),
    INDEX idx_mt_pollutant_name (pollutant_name),
    INDEX idx_mt_pollutant_code (pollutant_code)
);

-- Method variables
CREATE TABLE IF NOT EXISTS protocol_method_variables (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    method_template_id BIGINT NOT NULL,
    variable_key VARCHAR(60) NOT NULL,
    variable_label VARCHAR(200) NOT NULL,
    unit VARCHAR(40),
    type VARCHAR(20) NOT NULL DEFAULT 'NUMBER',
    required BOOLEAN NOT NULL DEFAULT TRUE,
    min_value DECIMAL(20,6),
    max_value DECIMAL(20,6),
    default_value DECIMAL(20,6),
    display_order INT
);

-- Raw measurements
CREATE TABLE IF NOT EXISTS protocol_raw_measurements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    protocol_result_id BIGINT NOT NULL,
    variable_key VARCHAR(60) NOT NULL,
    variable_value DECIMAL(20,6),
    unit VARCHAR(40),
    source_type VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    device_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rm_result_id (protocol_result_id)
);

-- Calculation runs
CREATE TABLE IF NOT EXISTS protocol_calculation_runs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    protocol_id BIGINT NOT NULL,
    protocol_result_id BIGINT NOT NULL,
    method_template_id BIGINT,
    input_json TEXT,
    formula_expression TEXT,
    calculated_value DECIMAL(20,6),
    average_value DECIMAL(20,6),
    uncertainty_value DECIMAL(20,6),
    final_result DECIMAL(20,6),
    normative_value DECIMAL(20,6),
    compliance_status VARCHAR(40),
    status VARCHAR(40),
    warnings_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    INDEX idx_cr_protocol_id (protocol_id),
    INDEX idx_cr_result_id (protocol_result_id)
);

-- Repeatability rules
CREATE TABLE IF NOT EXISTS protocol_repeatability_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    method_template_id BIGINT NOT NULL,
    name VARCHAR(200),
    max_difference_percent DECIMAL(10,4),
    message VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Uncertainty rules
CREATE TABLE IF NOT EXISTS protocol_uncertainty_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    method_template_id BIGINT NOT NULL,
    name VARCHAR(200),
    concentration_from DECIMAL(20,6),
    concentration_to DECIMAL(20,6),
    uncertainty_percent DECIMAL(10,4),
    absolute_uncertainty DECIMAL(20,6),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Add new columns to protocol_results.
-- "ADD COLUMN IF NOT EXISTS" is MariaDB-only syntax and fails on real MySQL (used in
-- docker-compose.yml/production) with a plain syntax error, so route through an
-- INFORMATION_SCHEMA-checked helper procedure instead.
DELIMITER //

CREATE PROCEDURE eco_v6_add_col_if_missing(
    IN tbl VARCHAR(64), IN col VARCHAR(64), IN col_def VARCHAR(500))
BEGIN
    SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col);
    IF @exists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', tbl, ' ADD COLUMN ', col, ' ', col_def);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

DELIMITER ;

CALL eco_v6_add_col_if_missing('protocol_results', 'pollutant_code', 'VARCHAR(64)');
CALL eco_v6_add_col_if_missing('protocol_results', 'method_template_id', 'BIGINT');
CALL eco_v6_add_col_if_missing('protocol_results', 'uncertainty_value', 'DECIMAL(20,6)');
CALL eco_v6_add_col_if_missing('protocol_results', 'calculation_status', 'VARCHAR(40)');
CALL eco_v6_add_col_if_missing('protocol_results', 'calculation_message', 'VARCHAR(500)');
CALL eco_v6_add_col_if_missing('protocol_results', 'calculated_at', 'DATETIME');

DROP PROCEDURE IF EXISTS eco_v6_add_col_if_missing;
