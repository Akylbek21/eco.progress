-- Adds columns needed for: (1) real CMS signature verification storing the signed PDF's hash and
-- extracted certificate metadata, (2) an optional soft link from a protocol to the order/CRM
-- request it was created for, (3) publish-to-client tracking, and (4) a forward pointer
-- (replaced_by_protocol_id) completing the bidirectional correction chain alongside the existing
-- backward pointer (replaced_protocol_id, added in V1/V2). All nullable, all additive - no
-- backfill is attempted for historical rows since none of this data existed before.
-- Same MySQL-safe idempotent-column/index pattern as V16/V23/.../V30.

DELIMITER //

CREATE PROCEDURE eco_v31_add_col_if_missing(
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

CREATE PROCEDURE eco_v31_create_index_if_missing(
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

CALL eco_v31_add_col_if_missing('lab_protocols', 'replaced_by_protocol_id', 'BIGINT');
CALL eco_v31_add_col_if_missing('lab_protocols', 'pdf_sha256', 'VARCHAR(64)');
CALL eco_v31_add_col_if_missing('lab_protocols', 'signature_certificate_metadata', 'TEXT');
CALL eco_v31_add_col_if_missing('lab_protocols', 'order_id', 'VARCHAR(32)');
CALL eco_v31_add_col_if_missing('lab_protocols', 'published_at', 'DATETIME');
CALL eco_v31_add_col_if_missing('lab_protocols', 'published_by', 'BIGINT');

CALL eco_v31_create_index_if_missing('lab_protocols', 'idx_lab_protocols_order_id', 'order_id');
CALL eco_v31_create_index_if_missing('lab_protocols', 'idx_lab_protocols_replaced_by_protocol_id', 'replaced_by_protocol_id');

DROP PROCEDURE IF EXISTS eco_v31_add_col_if_missing;
DROP PROCEDURE IF EXISTS eco_v31_create_index_if_missing;
