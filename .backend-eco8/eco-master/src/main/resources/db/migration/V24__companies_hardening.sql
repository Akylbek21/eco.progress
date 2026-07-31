-- Companies hardening: the `companies` table itself has historically been created by
-- SchemaMigration.migrateCompanies() (a startup CommandLineRunner), not Flyway - this migration
-- gives Flyway ownership of it going forward (idempotent CREATE TABLE IF NOT EXISTS, so it's a
-- no-op on environments where SchemaMigration already created it), adds the `notes` column, a
-- unique index on `bin`, a composite (status, created_at) index, and a FK from company_objects to
-- companies (never a FK the other way, and never ON DELETE CASCADE - protocols/contracts must
-- keep referencing a company even after it's archived).
-- Same MySQL-safe helper-procedure pattern as V16/V18/V19/V23 ("ADD COLUMN IF NOT EXISTS" is
-- MariaDB-only and fails on real MySQL).

CREATE TABLE IF NOT EXISTS companies (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    bin VARCHAR(32) NOT NULL,
    legal_address VARCHAR(500),
    actual_address VARCHAR(500),
    phone VARCHAR(64),
    email VARCHAR(255),
    comment VARCHAR(1000),
    notes VARCHAR(1000),
    director_name VARCHAR(255),
    director_position VARCHAR(255),
    responsible_person VARCHAR(255),
    responsible_person_phone VARCHAR(64),
    bank_name VARCHAR(255),
    iban VARCHAR(64),
    bik VARCHAR(64),
    kbe VARCHAR(32),
    knp VARCHAR(32),
    contract_number VARCHAR(128),
    contract_date DATE,
    object_name VARCHAR(255),
    object_address VARCHAR(500),
    activity_type VARCHAR(255),
    sampling_location VARCHAR(500),
    customer_representative VARCHAR(255),
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

DELIMITER //

CREATE PROCEDURE eco_v24_add_col_if_missing(
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

CREATE PROCEDURE eco_v24_add_fk_if_missing(
    IN tbl VARCHAR(64), IN fk_name VARCHAR(64), IN fk_def VARCHAR(500))
BEGIN
    SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND CONSTRAINT_NAME = fk_name);
    IF @exists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', tbl, ' ADD CONSTRAINT ', fk_name, ' ', fk_def);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

CREATE PROCEDURE eco_v24_create_index_if_missing(
    IN tbl VARCHAR(64), IN idx VARCHAR(64), IN idx_cols VARCHAR(500), IN unique_flag BOOLEAN)
BEGIN
    SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx);
    IF @exists = 0 THEN
        SET @sql = CONCAT('CREATE ', IF(unique_flag, 'UNIQUE INDEX', 'INDEX'), ' ', idx, ' ON ', tbl, ' (', idx_cols, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

DELIMITER ;

CALL eco_v24_add_col_if_missing('companies', 'notes', 'VARCHAR(1000)');

-- Drop the older, non-unique bin index from SchemaMigration.migrateCompanies() before adding the
-- unique one below - MySQL allows multiple indexes on the same column, but there is no reason to
-- keep the redundant plain one around once the unique index covers the same lookup.
SET @old_idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'companies' AND INDEX_NAME = 'idx_companies_bin');
SET @drop_sql = IF(@old_idx_exists > 0, 'DROP INDEX idx_companies_bin ON companies', 'SELECT 1');
PREPARE drop_stmt FROM @drop_sql;
EXECUTE drop_stmt;
DEALLOCATE PREPARE drop_stmt;

CALL eco_v24_create_index_if_missing('companies', 'ux_companies_bin', 'bin', TRUE);
CALL eco_v24_create_index_if_missing('companies', 'idx_companies_status_created_at', 'status, created_at', FALSE);

CALL eco_v24_add_fk_if_missing('company_objects', 'fk_company_objects_company',
        'FOREIGN KEY (company_id) REFERENCES companies(id)');

DROP PROCEDURE IF EXISTS eco_v24_add_col_if_missing;
DROP PROCEDURE IF EXISTS eco_v24_add_fk_if_missing;
DROP PROCEDURE IF EXISTS eco_v24_create_index_if_missing;
