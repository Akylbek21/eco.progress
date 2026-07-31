-- Safe migration: protocol_results columns + laboratories reference tables

CREATE TABLE IF NOT EXISTS protocol_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    protocol_id BIGINT NOT NULL,
    `row_number` INT NOT NULL,
    sample_date DATE,
    sampling_place VARCHAR(200),
    pollution_source_number VARCHAR(80),
    object_name VARCHAR(200),
    sample_name VARCHAR(200),
    indicator_name VARCHAR(200),
    unit VARCHAR(40),
    testing_method_nd VARCHAR(200),
    sampling_method_nd VARCHAR(200),
    normative_id BIGINT,
    normative_type VARCHAR(20),
    normative_value DECIMAL(20,6),
    min_value DECIMAL(20,6),
    max_value DECIMAL(20,6),
    result_value DECIMAL(20,6),
    comparison_type VARCHAR(30),
    internal_status VARCHAR(30),
    note VARCHAR(500),
    temperature_c DECIMAL(10,2),
    flow_speed_ms DECIMAL(10,4),
    gas_air_volume_nm3s DECIMAL(20,6),
    duct_area_m2 DECIMAL(20,6),
    pdv_mg_m3 DECIMAL(20,6),
    pdv_gs DECIMAL(20,6),
    result_mg_m3 DECIMAL(20,6),
    result_gs DECIMAL(20,6),
    pds_mg_dm3 DECIMAL(20,6),
    result_mg_dm3 DECIMAL(20,6),
    pdk_mg_m3 DECIMAL(20,6),
    pdk_or_background DECIMAL(20,6),
    vehicle_model VARCHAR(120),
    plate_number VARCHAR(20),
    co_percent DECIMAL(10,4),
    ch_ppm DECIMAL(10,4),
    smoke_k DECIMAL(10,4),
    smoke_n_percent DECIMAL(10,4),
    measurement_place VARCHAR(200),
    room_or_workplace VARCHAR(200),
    device_id BIGINT,
    verification_date DATE,
    verification_valid_until DATE,
    direction VARCHAR(40),
    external_laboratory BOOLEAN DEFAULT FALSE,
    external_laboratory_name VARCHAR(255),
    subtype VARCHAR(40),
    pollutant_code VARCHAR(64),
    method_template_id BIGINT,
    uncertainty_value DECIMAL(20,6),
    calculation_status VARCHAR(40),
    calculation_message VARCHAR(500),
    calculated_at DATETIME,
    INDEX idx_protocol_results_protocol_id (protocol_id),
    INDEX idx_protocol_results_row_number (protocol_id, `row_number`)
);

-- "ADD COLUMN IF NOT EXISTS" is MariaDB-only syntax and fails on real MySQL (used in
-- docker-compose.yml/production) with a plain syntax error, so route through an
-- INFORMATION_SCHEMA-checked helper procedure instead.
DELIMITER //

CREATE PROCEDURE eco_v7_add_col_if_missing(
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

CALL eco_v7_add_col_if_missing('protocol_results', 'pollutant_code', 'VARCHAR(64)');
CALL eco_v7_add_col_if_missing('protocol_results', 'method_template_id', 'BIGINT');
CALL eco_v7_add_col_if_missing('protocol_results', 'uncertainty_value', 'DECIMAL(20,6)');
CALL eco_v7_add_col_if_missing('protocol_results', 'calculation_status', 'VARCHAR(40)');
CALL eco_v7_add_col_if_missing('protocol_results', 'calculation_message', 'VARCHAR(500)');
CALL eco_v7_add_col_if_missing('protocol_results', 'calculated_at', 'DATETIME');

DROP PROCEDURE IF EXISTS eco_v7_add_col_if_missing;

CREATE TABLE IF NOT EXISTS laboratories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(300) NOT NULL,
    legal_name VARCHAR(300),
    bin VARCHAR(20),
    address VARCHAR(500),
    phone VARCHAR(64),
    email VARCHAR(255),
    accreditation_number VARCHAR(80),
    accreditation_issued_at DATE,
    accreditation_valid_until DATE,
    director_id BIGINT,
    director_name VARCHAR(200),
    laboratory_head_id BIGINT,
    laboratory_head_name VARCHAR(200),
    logo_url VARCHAR(500),
    standard_note TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_laboratories_active (active),
    INDEX idx_laboratories_default (is_default)
);

CREATE TABLE IF NOT EXISTS laboratory_employees (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    laboratory_id BIGINT NOT NULL,
    user_id BIGINT,
    full_name VARCHAR(200) NOT NULL,
    position VARCHAR(120),
    email VARCHAR(255),
    role VARCHAR(60),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_lab_employees_laboratory (laboratory_id),
    INDEX idx_lab_employees_user (user_id)
);
