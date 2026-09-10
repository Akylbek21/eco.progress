-- Additional indexes for protocol search performance.
-- "CREATE INDEX IF NOT EXISTS" is MariaDB-only syntax and fails on real MySQL (used in
-- docker-compose.yml/production) with a plain syntax error, so route through an
-- INFORMATION_SCHEMA-checked helper procedure instead.
DELIMITER //

CREATE PROCEDURE eco_v8_create_index_if_missing(
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

CALL eco_v8_create_index_if_missing('protocol_results', 'idx_protocol_results_pollutant_code', 'pollutant_code');
CALL eco_v8_create_index_if_missing('laboratory_employees', 'idx_laboratory_employees_laboratory_id', 'laboratory_id');

DROP PROCEDURE IF EXISTS eco_v8_create_index_if_missing;
