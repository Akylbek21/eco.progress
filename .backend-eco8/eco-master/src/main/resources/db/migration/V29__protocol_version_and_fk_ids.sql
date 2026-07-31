-- Protocols hardening: optimistic-locking version column, canonical laboratory_id/executor_id FK
-- columns (previously only name snapshots existed - see Protocol.java), and lookup indexes for
-- the new paginated GET /api/protocols filters. Existing rows get version=0 and null
-- laboratory_id/executor_id (backfilling them accurately isn't possible from the snapshot alone
-- in every historical case, so they stay null rather than an unreliable best-effort guess);
-- CompanyService's/ProtocolService's own field getters already treat null laboratoryId/executorId
-- as "unknown", not "unset invalid".
-- Same MySQL-safe idempotent-column/index pattern as V16/V18/.../V28.

DELIMITER //

CREATE PROCEDURE eco_v29_add_col_if_missing(
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

CREATE PROCEDURE eco_v29_create_index_if_missing(
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

CALL eco_v29_add_col_if_missing('lab_protocols', 'version', 'BIGINT NOT NULL DEFAULT 0');
CALL eco_v29_add_col_if_missing('lab_protocols', 'laboratory_id', 'BIGINT');
CALL eco_v29_add_col_if_missing('lab_protocols', 'executor_id', 'BIGINT');

CALL eco_v29_create_index_if_missing('lab_protocols', 'idx_lab_protocols_status', 'status');
CALL eco_v29_create_index_if_missing('lab_protocols', 'idx_lab_protocols_protocol_number', 'protocol_number');
CALL eco_v29_create_index_if_missing('lab_protocols', 'idx_lab_protocols_laboratory_id', 'laboratory_id');
CALL eco_v29_create_index_if_missing('lab_protocols', 'idx_lab_protocols_executor_id', 'executor_id');
CALL eco_v29_create_index_if_missing('lab_protocols', 'idx_lab_protocols_template_id', 'template_id');
CALL eco_v29_create_index_if_missing('lab_protocols', 'idx_lab_protocols_protocol_date', 'protocol_date');
CALL eco_v29_create_index_if_missing('lab_protocols', 'idx_lab_protocols_created_at', 'created_at');
-- protocol_results.protocol_id and protocol_documents.protocol_id already have indexes from V1/V4.

DROP PROCEDURE IF EXISTS eco_v29_add_col_if_missing;
DROP PROCEDURE IF EXISTS eco_v29_create_index_if_missing;
