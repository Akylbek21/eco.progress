-- Lab journals hardening:
--   - lab_journal_row_counters backs the new pessimistic-lock row-number allocator
--     (LabJournalRowCounterService) that replaces the old unlocked MAX(row_num)+1 query.
--   - laboratory_id becomes NOT NULL + FK'd (any pre-existing NULL rows are backfilled onto the
--     default laboratory first, so this doesn't fail on environments with older "global" entries
--     created before this constraint existed).
--   - created_by/updated_by get FKs to users.
--   - composite lookup index + a plain unique index on (laboratory_id, journal_type, row_num):
--     row numbers are only ever issued once and never reused after a soft-delete (the counter
--     always increments), so a full unique index is equivalent to the "WHERE deleted = false"
--     partial index in the ticket - MySQL doesn't support filtered/partial indexes at all.
--   - version column for optimistic locking.
-- Same MySQL-safe helper-procedure pattern as V16/V18/V19 ("ADD COLUMN IF NOT EXISTS" and FK-less
-- idempotent constraint checks are not directly supported on real MySQL).

CREATE TABLE IF NOT EXISTS lab_journal_row_counters (
    laboratory_id BIGINT NOT NULL,
    journal_type VARCHAR(100) NOT NULL,
    last_row_number INT NOT NULL DEFAULT 0,
    PRIMARY KEY (laboratory_id, journal_type)
);

DELIMITER //

CREATE PROCEDURE eco_v23_add_col_if_missing(
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

CREATE PROCEDURE eco_v23_add_fk_if_missing(
    IN tbl VARCHAR(64), IN fk_name VARCHAR(64), IN fk_def VARCHAR(500))
BEGIN
    SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND CONSTRAINT_NAME = fk_name);
    IF @exists = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', tbl, ' ADD CONSTRAINT ', fk_name, ' ', fk_def);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

CREATE PROCEDURE eco_v23_create_index_if_missing(
    IN tbl VARCHAR(64), IN idx VARCHAR(64), IN idx_cols VARCHAR(500), IN unique_flag BOOLEAN)
BEGIN
    SET @exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx);
    IF @exists = 0 THEN
        SET @sql = CONCAT('CREATE ', IF(unique_flag, 'UNIQUE INDEX', 'INDEX'), ' ', idx, ' ON ', tbl, ' (', idx_cols, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //

DELIMITER ;

CALL eco_v23_add_col_if_missing('lab_journal_entries', 'version', 'INT NOT NULL DEFAULT 0');

UPDATE lab_journal_entries e
JOIN laboratories l ON l.is_default = TRUE AND l.active = TRUE
SET e.laboratory_id = l.id
WHERE e.laboratory_id IS NULL;

ALTER TABLE lab_journal_entries MODIFY COLUMN laboratory_id BIGINT NOT NULL;

CALL eco_v23_add_fk_if_missing('lab_journal_entries', 'fk_lab_journal_entries_laboratory',
        'FOREIGN KEY (laboratory_id) REFERENCES laboratories(id)');
CALL eco_v23_add_fk_if_missing('lab_journal_entries', 'fk_lab_journal_entries_created_by',
        'FOREIGN KEY (created_by) REFERENCES users(id)');
CALL eco_v23_add_fk_if_missing('lab_journal_entries', 'fk_lab_journal_entries_updated_by',
        'FOREIGN KEY (updated_by) REFERENCES users(id)');

CALL eco_v23_create_index_if_missing('lab_journal_entries', 'idx_lab_journal_lab_type_date',
        'laboratory_id, journal_type, entry_date', FALSE);
CALL eco_v23_create_index_if_missing('lab_journal_entries', 'ux_lab_journal_active_row',
        'laboratory_id, journal_type, row_num', TRUE);

DROP PROCEDURE IF EXISTS eco_v23_add_col_if_missing;
DROP PROCEDURE IF EXISTS eco_v23_add_fk_if_missing;
DROP PROCEDURE IF EXISTS eco_v23_create_index_if_missing;
