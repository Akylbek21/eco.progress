-- Protocol module: create all required tables if they do not exist.
-- Safe for repeated runs: every statement uses IF NOT EXISTS.

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
    INDEX idx_protocol_results_protocol_id (protocol_id),
    INDEX idx_protocol_results_row_number (protocol_id, `row_number`)
);

CREATE TABLE IF NOT EXISTS measurement_devices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    model VARCHAR(120),
    serial_number VARCHAR(80),
    verification_certificate_number VARCHAR(80),
    verification_date DATE,
    verification_valid_until DATE,
    units VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'VALID',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS normative_references (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_code VARCHAR(60) NOT NULL,
    object_type VARCHAR(120),
    indicator_name VARCHAR(200) NOT NULL,
    unit VARCHAR(40),
    normative_type VARCHAR(20),
    normative_value DECIMAL(20,6),
    min_value DECIMAL(20,6),
    max_value DECIMAL(20,6),
    comparison_type VARCHAR(30),
    normative_document VARCHAR(300),
    testing_method_nd VARCHAR(200),
    sampling_method_nd VARCHAR(200),
    active_from DATE,
    active_to DATE,
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
