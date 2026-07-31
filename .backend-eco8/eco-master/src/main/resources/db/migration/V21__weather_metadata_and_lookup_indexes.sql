-- Weather manual-override metadata on protocol_environment_conditions (see
-- ProtocolEnvironmentConditions.java / ProtocolService.saveEnvironmentConditions), plus a handful
-- of lookup indexes that were missing for columns already introduced by earlier migrations:
--   - protocol_results.device_id (the measurement-device FK a result row is attached to - see
--     ProtocolService.applyMeasurementDeviceForQuickCreate/validateMeasurementDevice) had no index.
--   - normative_records.pollutant_code and .factor_type were not covered by V18's index batch
--     (which added source_document_code/template_type/category_code/etc.) even though they are
--     hot filter columns for NormativeDirectoryService/ProtocolNormativeCheckService lookups.
-- Same MySQL-safe helper-procedure pattern as V18/V19/V20 ("ADD COLUMN IF NOT EXISTS"/"CREATE
-- INDEX IF NOT EXISTS" are MariaDB-only and fail on real MySQL).
DELIMITER //

CREATE PROCEDURE eco_v21_add_col_if_missing(
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

CREATE PROCEDURE eco_v21_create_index_if_missing(
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

CALL eco_v21_add_col_if_missing('protocol_environment_conditions', 'source', 'VARCHAR(60)');
CALL eco_v21_add_col_if_missing('protocol_environment_conditions', 'data_source', 'VARCHAR(120)');
CALL eco_v21_add_col_if_missing('protocol_environment_conditions', 'manual_change_reason', 'VARCHAR(500)');
CALL eco_v21_add_col_if_missing('protocol_environment_conditions', 'weather_observed_at', 'TIMESTAMP NULL');

CALL eco_v21_create_index_if_missing('protocol_results', 'idx_protocol_results_device_id', 'device_id');
CALL eco_v21_create_index_if_missing('normative_records', 'idx_normative_pollutant_code', 'pollutant_code');
CALL eco_v21_create_index_if_missing('normative_records', 'idx_normative_factor_type', 'factor_type');

DROP PROCEDURE IF EXISTS eco_v21_add_col_if_missing;
DROP PROCEDURE IF EXISTS eco_v21_create_index_if_missing;
