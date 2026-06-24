-- Safe additive migration for an existing MySQL database.
-- V1/V2 are intentionally not modified. No existing data is deleted.

CREATE TABLE IF NOT EXISTS protocol_results (
    id BIGINT NOT NULL AUTO_INCREMENT,
    protocol_id BIGINT NOT NULL,
    row_number INT NOT NULL DEFAULT 0,

    sample_name VARCHAR(255) NULL,
    sampling_date DATE NULL,
    sampling_place VARCHAR(500) NULL,
    sampling_point VARCHAR(500) NULL,
    source_number VARCHAR(128) NULL,
    object_name VARCHAR(500) NULL,
    direction VARCHAR(64) NULL,
    subtype VARCHAR(64) NULL,
    indicator VARCHAR(500) NULL,
    unit VARCHAR(128) NULL,

    temperature_c DECIMAL(19, 8) NULL,
    speed_ms DECIMAL(19, 8) NULL,
    gas_volume DECIMAL(19, 8) NULL,
    duct_area DECIMAL(19, 8) NULL,
    mdv_mg_m3 DECIMAL(19, 8) NULL,
    mdv_g_s DECIMAL(19, 8) NULL,
    result_mg_m3 DECIMAL(19, 8) NULL,
    result_g_s DECIMAL(19, 8) NULL,
    smoke_k DECIMAL(19, 8) NULL,
    smoke_n_percent DECIMAL(19, 8) NULL,

    normative_value DECIMAL(30, 15) NULL,
    min_value DECIMAL(30, 15) NULL,
    max_value DECIMAL(30, 15) NULL,
    result_value DECIMAL(30, 15) NULL,
    comparison_type VARCHAR(32) NULL,
    internal_status VARCHAR(32) NOT NULL DEFAULT 'EMPTY_RESULT',

    sampling_method VARCHAR(1000) NULL,
    testing_method VARCHAR(1000) NULL,
    testing_method_document VARCHAR(1000) NULL,
    normative_document VARCHAR(1000) NULL,
    external_laboratory VARCHAR(500) NULL,
    device_id BIGINT NULL,
    comment TEXT NULL,

    -- Keeps template-specific values without losing precision or unknown fields.
    values_json JSON NULL,

    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),

    PRIMARY KEY (id),
    INDEX idx_protocol_results_protocol_id (protocol_id),
    INDEX idx_protocol_results_protocol_row (protocol_id, row_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
