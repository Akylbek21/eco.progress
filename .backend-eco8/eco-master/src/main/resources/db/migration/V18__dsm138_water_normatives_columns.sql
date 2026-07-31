-- Adds the columns DSM_138 (water normatives) needs on top of the existing normative_records
-- table, plus lookup indexes. Adapted to MySQL:
--   - "ADD COLUMN IF NOT EXISTS" is MariaDB-only syntax and fails on real MySQL, so this routes
--     through the same INFORMATION_SCHEMA-checked helper procedure pattern already used by
--     V6/V7/V8/V9/V16 in this project.
--   - MySQL has no GIN index / pg_trgm extension, so the trigram search indexes requested for
--     Postgres are skipped; LIKE-based search on indicator/pollutant name is what the rest of
--     this codebase already relies on (see NormativeMatchingUtils), and pagination + the
--     frontend's minimum search length keep result sets small enough for that to be adequate.
--   - "status" and "template_id"/"indicator_name" map onto existing columns (active,
--     template_type, indicator_name_ru respectively) instead of duplicating them - see
--     NormativeRecord.java / Dsm138 import code for the mapping.
DELIMITER //

CREATE PROCEDURE eco_v18_add_col_if_missing(
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

CREATE PROCEDURE eco_v18_create_index_if_missing(
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

CALL eco_v18_add_col_if_missing('normative_records', 'category_code', 'VARCHAR(60)');
CALL eco_v18_add_col_if_missing('normative_records', 'synonyms', 'VARCHAR(500)');
CALL eco_v18_add_col_if_missing('normative_records', 'alternative_normative_value', 'DECIMAL(20,6)');
CALL eco_v18_add_col_if_missing('normative_records', 'water_type', 'VARCHAR(40)');
CALL eco_v18_add_col_if_missing('normative_records', 'water_use_category', 'VARCHAR(120)');
CALL eco_v18_add_col_if_missing('normative_records', 'notes', 'VARCHAR(500)');
CALL eco_v18_add_col_if_missing('normative_records', 'section_name', 'VARCHAR(300)');

CALL eco_v18_create_index_if_missing('normative_records', 'idx_normative_source_document_code', 'source_document_code');
CALL eco_v18_create_index_if_missing('normative_records', 'idx_normative_environment_type', 'environment_type');
CALL eco_v18_create_index_if_missing('normative_records', 'idx_normative_template_type', 'template_type');
CALL eco_v18_create_index_if_missing('normative_records', 'idx_normative_appendix_no', 'appendix_no');
CALL eco_v18_create_index_if_missing('normative_records', 'idx_normative_table_no', 'table_no');
CALL eco_v18_create_index_if_missing('normative_records', 'idx_normative_category_code', 'category_code');
CALL eco_v18_create_index_if_missing('normative_records', 'idx_normative_active', 'active');

DROP PROCEDURE IF EXISTS eco_v18_add_col_if_missing;
DROP PROCEDURE IF EXISTS eco_v18_create_index_if_missing;

-- Some DSM_138 microbiological indicators spell out a full unit description instead of a short
-- symbol (e.g. "мг/л"), which doesn't fit the original VARCHAR(40). MODIFY COLUMN is safe to run
-- unconditionally/repeatedly (no data loss widening a VARCHAR).
ALTER TABLE normative_records MODIFY COLUMN unit VARCHAR(150);
