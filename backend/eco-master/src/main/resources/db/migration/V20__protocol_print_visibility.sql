-- Per-field DOCX/PDF print visibility toggles (ProtocolPrintVisibility), stored as a sparse
-- JSON map on the protocol itself - a field absent from the map defaults to visible. Hiding a
-- field only affects what gets rendered into the generated document; the field's real value
-- stays untouched elsewhere. Same MySQL-safe helper-procedure pattern as V18/V19 ("ADD COLUMN
-- IF NOT EXISTS" is MariaDB-only and fails on real MySQL).
DELIMITER //

CREATE PROCEDURE eco_v20_add_col_if_missing(
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

CALL eco_v20_add_col_if_missing('lab_protocols', 'print_visibility_json', 'TEXT');

DROP PROCEDURE IF EXISTS eco_v20_add_col_if_missing;
