-- lab_protocols was never created by Flyway anywhere (V1 doesn't have it) — every migration
-- below assumes it already exists via Hibernate ddl-auto=update. On a clean database that
-- assumption is false and this migration fails outright, so create it here if missing.
CREATE TABLE IF NOT EXISTS lab_protocols (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL,
    protocol_number VARCHAR(40) NOT NULL UNIQUE,
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
    product_nd VARCHAR(200),
    sampling_method_nd VARCHAR(200),
    testing_method_nd VARCHAR(200),
    sample_date DATE,
    test_date DATE,
    test_purpose VARCHAR(300),
    environment_conditions VARCHAR(300),
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
    instruments_json TEXT
);

-- Add new columns to lab_protocols for template types, subtype, snapshots, compliance.
-- Each ALTER is wrapped in a procedure to make it idempotent on MySQL.

DELIMITER //

CREATE PROCEDURE eco_add_col_if_missing(
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

CALL eco_add_col_if_missing('lab_protocols', 'template_code', 'VARCHAR(60)');
CALL eco_add_col_if_missing('lab_protocols', 'subtype', 'VARCHAR(40)');
CALL eco_add_col_if_missing('lab_protocols', 'form_code', 'VARCHAR(40)');
CALL eco_add_col_if_missing('lab_protocols', 'appendix_number', 'VARCHAR(20)');
CALL eco_add_col_if_missing('lab_protocols', 'object_id', 'BIGINT');
CALL eco_add_col_if_missing('lab_protocols', 'company_snapshot', 'JSON');
CALL eco_add_col_if_missing('lab_protocols', 'object_snapshot', 'JSON');
CALL eco_add_col_if_missing('lab_protocols', 'laboratory_snapshot', 'JSON');
CALL eco_add_col_if_missing('lab_protocols', 'testing_basis', 'VARCHAR(500)');
CALL eco_add_col_if_missing('lab_protocols', 'product_normative_document', 'VARCHAR(300)');
CALL eco_add_col_if_missing('lab_protocols', 'sampling_method_document', 'VARCHAR(300)');
CALL eco_add_col_if_missing('lab_protocols', 'testing_method_document', 'VARCHAR(300)');
CALL eco_add_col_if_missing('lab_protocols', 'testing_start_date', 'DATE');
CALL eco_add_col_if_missing('lab_protocols', 'testing_end_date', 'DATE');
CALL eco_add_col_if_missing('lab_protocols', 'testing_purpose', 'VARCHAR(500)');
CALL eco_add_col_if_missing('lab_protocols', 'explanatory_note', 'TEXT');
CALL eco_add_col_if_missing('lab_protocols', 'compliance_document', 'VARCHAR(300)');
CALL eco_add_col_if_missing('lab_protocols', 'compliance_status', 'VARCHAR(30)');

DROP PROCEDURE IF EXISTS eco_add_col_if_missing;
