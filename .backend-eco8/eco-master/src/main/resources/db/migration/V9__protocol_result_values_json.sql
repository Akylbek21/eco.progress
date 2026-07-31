-- "ADD COLUMN IF NOT EXISTS" is MariaDB-only syntax and fails on real MySQL (used in
-- docker-compose.yml/production) with a plain syntax error, so route through an
-- INFORMATION_SCHEMA-checked helper procedure instead.
DELIMITER //

CREATE PROCEDURE eco_v9_add_col_if_missing(
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

CALL eco_v9_add_col_if_missing('protocol_results', 'values_json', 'TEXT');
CALL eco_v9_add_col_if_missing('lab_protocols', 'measurement_time', 'VARCHAR(20)');
CALL eco_v9_add_col_if_missing('lab_protocols', 'source_number', 'VARCHAR(80)');

DROP PROCEDURE IF EXISTS eco_v9_add_col_if_missing;
