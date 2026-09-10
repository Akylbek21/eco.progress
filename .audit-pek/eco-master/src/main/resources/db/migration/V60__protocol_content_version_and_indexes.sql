-- Module spec §5/§16: an explicit content-version aggregate token on lab_protocols, separate
-- from the JPA @Version column - see Protocol.java's javadoc on contentVersion for why the plain
-- @Version alone isn't reliable (child-row edits don't always touch the parent row's version).
-- Also adds the search/index set called out in spec §16 that doesn't exist yet. Same MySQL-safe
-- idempotent add-column/add-index pattern as V16/V29/V31/V33/V53.

DELIMITER //

CREATE PROCEDURE eco_v60_add_col_if_missing(
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

CREATE PROCEDURE eco_v60_create_index_if_missing(
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

CALL eco_v60_add_col_if_missing('lab_protocols', 'content_version', 'BIGINT NOT NULL DEFAULT 0');
CALL eco_v60_add_col_if_missing('lab_protocols', 'order_service_item_id', 'VARCHAR(64)');
CALL eco_v60_add_col_if_missing('protocol_audit_logs', 'old_version', 'BIGINT');
CALL eco_v60_add_col_if_missing('protocol_audit_logs', 'new_version', 'BIGINT');

CALL eco_v60_create_index_if_missing('lab_protocols', 'idx_lab_protocols_status', 'status');
CALL eco_v60_create_index_if_missing('lab_protocols', 'idx_lab_protocols_company_id', 'company_id');
CALL eco_v60_create_index_if_missing('lab_protocols', 'idx_lab_protocols_order_id', 'order_id');
CALL eco_v60_create_index_if_missing('lab_protocols', 'idx_lab_protocols_created_at', 'created_at');
CALL eco_v60_create_index_if_missing('lab_protocols', 'idx_lab_protocols_updated_at', 'updated_at');
CALL eco_v60_create_index_if_missing('lab_protocols', 'idx_lab_protocols_content_version', 'content_version');

CALL eco_v60_create_index_if_missing('protocol_results', 'idx_protocol_results_protocol_id', 'protocol_id');
CALL eco_v60_create_index_if_missing('protocol_results', 'idx_protocol_results_normative_id', 'normative_id');

CALL eco_v60_create_index_if_missing('protocol_signatures', 'idx_protocol_signatures_protocol_id', 'protocol_id');

CALL eco_v60_create_index_if_missing('normative_records', 'idx_normative_records_pollutant_code', 'pollutant_code');
CALL eco_v60_create_index_if_missing('normative_records', 'idx_normative_records_indicator_name', 'indicator_name_ru');

DROP PROCEDURE IF EXISTS eco_v60_add_col_if_missing;
DROP PROCEDURE IF EXISTS eco_v60_create_index_if_missing;
