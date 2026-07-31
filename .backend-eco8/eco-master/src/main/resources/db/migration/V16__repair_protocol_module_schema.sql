-- Repair migration for the protocol module.
--
-- Context: on a database whose schema was seeded before Flyway was introduced (or where
-- baseline-on-migrate skipped V1/V2/V3/V7), the protocol tables were created and evolved
-- solely by Hibernate `ddl-auto=update`, not by Flyway. This migration makes Flyway the
-- single source of truth by (re-)asserting the full required schema:
--   1. CREATE TABLE IF NOT EXISTS for every required table, with the complete column set.
--   2. ADD COLUMN IF NOT EXISTS (via helper procedure) for columns that may be missing on
--      a table that already existed before this migration ran.
--   3. CREATE INDEX IF NOT EXISTS (via helper procedure) for every required index.
-- Nothing here ever drops a table or a column, so it is safe to run against a populated
-- production database as well as an empty one.

-- ---------------------------------------------------------------------------------------
-- Helper procedures (idempotent ADD COLUMN / CREATE INDEX on real MySQL, which does not
-- support "ADD COLUMN IF NOT EXISTS" / "CREATE INDEX IF NOT EXISTS" as valid syntax).
-- ---------------------------------------------------------------------------------------
DELIMITER //

CREATE PROCEDURE eco_v16_add_col_if_missing(
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

CREATE PROCEDURE eco_v16_create_index_if_missing(
    IN tbl VARCHAR(64), IN idx VARCHAR(64), IN idx_cols VARCHAR(500))
BEGIN
    SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx);
    IF @exists = 0 THEN
        SET @sql = CONCAT('CREATE INDEX ', idx, ' ON ', tbl, ' (', idx_cols, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

DELIMITER ;

-- ---------------------------------------------------------------------------------------
-- 1. CREATE TABLE IF NOT EXISTS: full column set for every required table.
-- ---------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lab_protocols (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL,
    template_code VARCHAR(60),
    subtype VARCHAR(40),
    protocol_number VARCHAR(40) NOT NULL UNIQUE,
    form_code VARCHAR(40),
    appendix_number VARCHAR(20),
    protocol_date DATE NOT NULL,
    total_pages INT,
    laboratory_name VARCHAR(300),
    laboratory_address VARCHAR(400),
    accreditation_number VARCHAR(80),
    accreditation_valid_from DATE,
    accreditation_valid_until DATE,
    director_name VARCHAR(200),
    head_of_laboratory_name VARCHAR(200),
    executor_name VARCHAR(200),
    organization_name VARCHAR(300),
    organization_address VARCHAR(400),
    company_id BIGINT,
    object_id BIGINT,
    company_snapshot JSON,
    object_snapshot JSON,
    laboratory_snapshot JSON,
    company_name_snapshot VARCHAR(255),
    company_bin_snapshot VARCHAR(32),
    company_legal_address_snapshot VARCHAR(500),
    company_actual_address_snapshot VARCHAR(500),
    company_phone_snapshot VARCHAR(64),
    company_email_snapshot VARCHAR(255),
    company_director_name_snapshot VARCHAR(255),
    company_director_position_snapshot VARCHAR(255),
    company_responsible_person_snapshot VARCHAR(255),
    company_responsible_person_phone_snapshot VARCHAR(64),
    company_bank_name_snapshot VARCHAR(255),
    company_iban_snapshot VARCHAR(64),
    company_bik_snapshot VARCHAR(64),
    company_kbe_snapshot VARCHAR(32),
    company_knp_snapshot VARCHAR(32),
    company_contract_number_snapshot VARCHAR(128),
    company_contract_date_snapshot DATE,
    product_name VARCHAR(300),
    object_name VARCHAR(300),
    object_name_snapshot VARCHAR(255),
    object_address_snapshot VARCHAR(500),
    activity_type_snapshot VARCHAR(255),
    sampling_location_snapshot VARCHAR(500),
    customer_representative_snapshot VARCHAR(255),
    basis_for_testing VARCHAR(500),
    testing_basis VARCHAR(500),
    product_nd VARCHAR(200),
    product_normative_document VARCHAR(300),
    sampling_method_nd VARCHAR(200),
    sampling_method_document VARCHAR(300),
    testing_method_nd VARCHAR(200),
    testing_method_document VARCHAR(300),
    sample_date DATE,
    test_date DATE,
    testing_start_date DATE,
    testing_end_date DATE,
    test_purpose VARCHAR(300),
    testing_purpose VARCHAR(500),
    environment_conditions VARCHAR(300),
    measurement_time VARCHAR(20),
    source_number VARCHAR(80),
    explanatory_note TEXT,
    compliance_document VARCHAR(300),
    compliance_status VARCHAR(30),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    approved_by BIGINT,
    approved_at DATETIME,
    signed_by BIGINT,
    signed_at DATETIME,
    signature_file_id VARCHAR(64),
    pdf_file_id VARCHAR(64),
    docx_file_id VARCHAR(64),
    replaced_protocol_id BIGINT,
    replacement_reason VARCHAR(500),
    instruments_json TEXT,
    deleted_at TIMESTAMP NULL,
    INDEX idx_lab_protocols_company_id (company_id),
    INDEX idx_lab_protocols_object_id (object_id),
    INDEX idx_lab_protocols_status (status),
    INDEX idx_lab_protocols_created_at (created_at)
);

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
    values_json TEXT,
    INDEX idx_protocol_results_protocol_id (protocol_id),
    INDEX idx_protocol_results_row_number (protocol_id, `row_number`),
    INDEX idx_protocol_results_pollutant_code (pollutant_code)
);

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

CREATE TABLE IF NOT EXISTS company_objects (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500),
    activity_type VARCHAR(255),
    sampling_location VARCHAR(500),
    coordinates VARCHAR(100),
    sanitary_zone VARCHAR(200),
    notes VARCHAR(1000),
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_company_objects_company_id (company_id),
    INDEX idx_company_objects_status (status)
);

CREATE TABLE IF NOT EXISTS protocol_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    form_code VARCHAR(40),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS protocol_audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    protocol_id BIGINT NOT NULL,
    action VARCHAR(30) NOT NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    user_id BIGINT,
    comment VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_protocol_audit_logs_protocol_id (protocol_id)
);

CREATE TABLE IF NOT EXISTS protocol_environment_conditions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    protocol_id BIGINT NOT NULL UNIQUE,
    temperature_c DECIMAL(10,4),
    temperature_min_c DECIMAL(10,4),
    temperature_max_c DECIMAL(10,4),
    humidity_percent DECIMAL(10,4),
    humidity_min_percent DECIMAL(10,4),
    humidity_max_percent DECIMAL(10,4),
    pressure_kpa DECIMAL(20,12),
    wind_speed_ms DECIMAL(10,4),
    conditions_comment VARCHAR(500)
);

-- ---------------------------------------------------------------------------------------
-- 2. ADD COLUMN IF NOT EXISTS (via helper): repairs a lab_protocols/protocol_results table
--    that already existed (e.g. created solely by Hibernate ddl-auto=update) before this
--    migration ran, and is therefore missing columns added over the lifetime of the entity.
--    All added columns are nullable so this is safe on populated tables.
-- ---------------------------------------------------------------------------------------

CALL eco_v16_add_col_if_missing('lab_protocols', 'template_code', 'VARCHAR(60)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'subtype', 'VARCHAR(40)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'form_code', 'VARCHAR(40)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'appendix_number', 'VARCHAR(20)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'object_id', 'BIGINT');
CALL eco_v16_add_col_if_missing('lab_protocols', 'company_snapshot', 'JSON');
CALL eco_v16_add_col_if_missing('lab_protocols', 'object_snapshot', 'JSON');
CALL eco_v16_add_col_if_missing('lab_protocols', 'laboratory_snapshot', 'JSON');
CALL eco_v16_add_col_if_missing('lab_protocols', 'object_name_snapshot', 'VARCHAR(255)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'object_address_snapshot', 'VARCHAR(500)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'activity_type_snapshot', 'VARCHAR(255)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'sampling_location_snapshot', 'VARCHAR(500)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'customer_representative_snapshot', 'VARCHAR(255)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'basis_for_testing', 'VARCHAR(500)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'testing_basis', 'VARCHAR(500)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'product_normative_document', 'VARCHAR(300)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'sampling_method_document', 'VARCHAR(300)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'testing_method_document', 'VARCHAR(300)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'testing_start_date', 'DATE');
CALL eco_v16_add_col_if_missing('lab_protocols', 'testing_end_date', 'DATE');
CALL eco_v16_add_col_if_missing('lab_protocols', 'testing_purpose', 'VARCHAR(500)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'measurement_time', 'VARCHAR(20)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'source_number', 'VARCHAR(80)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'explanatory_note', 'TEXT');
CALL eco_v16_add_col_if_missing('lab_protocols', 'compliance_document', 'VARCHAR(300)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'compliance_status', 'VARCHAR(30)');
CALL eco_v16_add_col_if_missing('lab_protocols', 'deleted_at', 'TIMESTAMP NULL');

CALL eco_v16_add_col_if_missing('protocol_results', 'pollutant_code', 'VARCHAR(64)');
CALL eco_v16_add_col_if_missing('protocol_results', 'method_template_id', 'BIGINT');
CALL eco_v16_add_col_if_missing('protocol_results', 'uncertainty_value', 'DECIMAL(20,6)');
CALL eco_v16_add_col_if_missing('protocol_results', 'calculation_status', 'VARCHAR(40)');
CALL eco_v16_add_col_if_missing('protocol_results', 'calculation_message', 'VARCHAR(500)');
CALL eco_v16_add_col_if_missing('protocol_results', 'calculated_at', 'DATETIME');
CALL eco_v16_add_col_if_missing('protocol_results', 'values_json', 'TEXT');

-- ---------------------------------------------------------------------------------------
-- 3. CREATE INDEX IF NOT EXISTS (via helper): required indexes, safe against duplicates
--    already created under these exact names by earlier migrations.
-- ---------------------------------------------------------------------------------------

CALL eco_v16_create_index_if_missing('lab_protocols', 'idx_lab_protocols_company_id', 'company_id');
CALL eco_v16_create_index_if_missing('lab_protocols', 'idx_lab_protocols_object_id', 'object_id');
CALL eco_v16_create_index_if_missing('lab_protocols', 'idx_lab_protocols_status', 'status');
CALL eco_v16_create_index_if_missing('lab_protocols', 'idx_lab_protocols_created_at', 'created_at');

CALL eco_v16_create_index_if_missing('protocol_results', 'idx_protocol_results_protocol_id', 'protocol_id');
CALL eco_v16_create_index_if_missing('protocol_results', 'idx_protocol_results_row_number', 'protocol_id, `row_number`');
CALL eco_v16_create_index_if_missing('protocol_results', 'idx_protocol_results_pollutant_code', 'pollutant_code');

CALL eco_v16_create_index_if_missing('laboratories', 'idx_laboratories_active', 'active');
CALL eco_v16_create_index_if_missing('laboratories', 'idx_laboratories_default', 'is_default');

CALL eco_v16_create_index_if_missing('laboratory_employees', 'idx_lab_employees_laboratory', 'laboratory_id');
CALL eco_v16_create_index_if_missing('laboratory_employees', 'idx_lab_employees_user', 'user_id');

CALL eco_v16_create_index_if_missing('company_objects', 'idx_company_objects_company_id', 'company_id');
CALL eco_v16_create_index_if_missing('company_objects', 'idx_company_objects_status', 'status');

DROP PROCEDURE IF EXISTS eco_v16_add_col_if_missing;
DROP PROCEDURE IF EXISTS eco_v16_create_index_if_missing;
