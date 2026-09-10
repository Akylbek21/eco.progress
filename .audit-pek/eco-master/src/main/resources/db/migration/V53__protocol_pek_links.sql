-- Soft links from lab_protocols into the ПЭК (производственный экологический контроль) module,
-- mirroring the existing order_id pattern (nullable, no FK constraint - see V31). pek_program_id
-- and pek_report_id reference real kz.eco.pek entities (PekProgram/PekReport); the other five
-- columns are reserved for control-item/monitoring-point/emission-source/water-outlet entities
-- that don't exist anywhere in this codebase yet, so they carry no validation today - see
-- Protocol.java's javadoc on these fields.
-- Same MySQL-safe idempotent-column/index pattern as V16/V29/V31/V33/etc.

DELIMITER //

CREATE PROCEDURE eco_v53_add_col_if_missing(
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

CREATE PROCEDURE eco_v53_create_index_if_missing(
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

CALL eco_v53_add_col_if_missing('lab_protocols', 'pek_program_id', 'BIGINT');
CALL eco_v53_add_col_if_missing('lab_protocols', 'pek_report_id', 'BIGINT');
CALL eco_v53_add_col_if_missing('lab_protocols', 'pek_control_item_id', 'BIGINT');
CALL eco_v53_add_col_if_missing('lab_protocols', 'pek_control_event_id', 'BIGINT');
CALL eco_v53_add_col_if_missing('lab_protocols', 'monitoring_point_id', 'BIGINT');
CALL eco_v53_add_col_if_missing('lab_protocols', 'emission_source_id', 'BIGINT');
CALL eco_v53_add_col_if_missing('lab_protocols', 'water_outlet_id', 'BIGINT');

CALL eco_v53_create_index_if_missing('lab_protocols', 'idx_lab_protocols_pek_program_id', 'pek_program_id');
CALL eco_v53_create_index_if_missing('lab_protocols', 'idx_lab_protocols_pek_report_id', 'pek_report_id');

DROP PROCEDURE IF EXISTS eco_v53_add_col_if_missing;
DROP PROCEDURE IF EXISTS eco_v53_create_index_if_missing;
