-- Section 29 of the spec: a lightweight, optional link from a lab journal entry to the
-- protocol/result that produced it (protocol_id, protocol_result_id, sample_id), plus a frozen
-- results_snapshot JSON column for recording which protocol results fed the entry at link time.
-- Deliberately a soft reference only - no FK constraint to lab_protocols/protocol_results - so the
-- journal module keeps no hard dependency on the protocol tables, and existing/historical journal
-- rows are never auto-updated by this migration (all new columns are NULL by default; nothing is
-- backfilled). Same MySQL-safe idempotent-column/index pattern as V23/V29.

DELIMITER //

CREATE PROCEDURE eco_v30_add_col_if_missing(
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

CREATE PROCEDURE eco_v30_create_index_if_missing(
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

CALL eco_v30_add_col_if_missing('lab_journal_entries', 'protocol_id', 'BIGINT NULL');
CALL eco_v30_add_col_if_missing('lab_journal_entries', 'protocol_result_id', 'BIGINT NULL');
CALL eco_v30_add_col_if_missing('lab_journal_entries', 'sample_id', 'VARCHAR(64) NULL');
CALL eco_v30_add_col_if_missing('lab_journal_entries', 'results_snapshot', 'JSON NULL');

CALL eco_v30_create_index_if_missing('lab_journal_entries', 'idx_lab_journal_entries_protocol_id', 'protocol_id');

DROP PROCEDURE IF EXISTS eco_v30_add_col_if_missing;
DROP PROCEDURE IF EXISTS eco_v30_create_index_if_missing;
