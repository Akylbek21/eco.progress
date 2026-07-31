-- Laboratory logo storage: logo_url now always holds the stable
-- /api/settings/laboratories/{id}/logo API path, while logo_file_id points at the actual
-- stored bytes in FileStorageService so the GET/DELETE logo endpoints and DOCX generation can
-- retrieve them. Same MySQL-safe helper-procedure pattern as V18 ("ADD COLUMN IF NOT EXISTS" is
-- MariaDB-only and fails on real MySQL).
DELIMITER //

CREATE PROCEDURE eco_v19_add_col_if_missing(
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

CALL eco_v19_add_col_if_missing('laboratories', 'logo_file_id', 'VARCHAR(64)');
CALL eco_v19_add_col_if_missing('lab_protocols', 'laboratory_logo_file_id', 'VARCHAR(64)');

DROP PROCEDURE IF EXISTS eco_v19_add_col_if_missing;
