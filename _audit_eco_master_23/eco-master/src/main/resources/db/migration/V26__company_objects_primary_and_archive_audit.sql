-- Fixes the "virtual object" architecture problem: every company with no company_objects row
-- gets a REAL primary object materialized here, carrying over whatever object-ish data lived on
-- the company row (objectName/objectAddress/activityType/samplingLocation/comment). Going forward
-- application code never treats companyId as a stand-in objectId - CompanyService's
-- materializePrimaryObject() is the same logic run transactionally as a safety net if a company
-- is ever found without one again (e.g. a row inserted by a bypassing script).
--
-- is_primary + the generated "primary_marker" unique index emulate a partial unique index
-- ("at most one is_primary=true row per company") - MySQL has no native partial/filtered unique
-- index, so a STORED generated column that's NULL unless is_primary=1 is used instead: MySQL
-- unique indexes allow unlimited NULLs, so only the TRUE rows are constrained.
--
-- Same MySQL-safe helper-procedure pattern as V16/V18/V19/V23/V24/V25 ("ADD COLUMN IF NOT
-- EXISTS" is not supported the way it is on MariaDB/H2).

DELIMITER //

CREATE PROCEDURE eco_v26_add_col_if_missing(
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

CREATE PROCEDURE eco_v26_create_index_if_missing(
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

CALL eco_v26_add_col_if_missing('company_objects', 'is_primary', 'BOOLEAN NOT NULL DEFAULT FALSE');
CALL eco_v26_add_col_if_missing('company_objects', 'archived_at', 'TIMESTAMP NULL');
CALL eco_v26_add_col_if_missing('company_objects', 'archived_by', 'BIGINT');
CALL eco_v26_add_col_if_missing('companies', 'archived_at', 'TIMESTAMP NULL');
CALL eco_v26_add_col_if_missing('companies', 'archived_by', 'BIGINT');

-- 1) Materialize a real primary object for every company that has none at all.
INSERT INTO company_objects (company_id, name, address, activity_type, sampling_location, notes,
                              status, is_primary, created_at, updated_at)
SELECT
    c.id,
    COALESCE(NULLIF(TRIM(c.object_name), ''), CONCAT('Основной объект - ', c.name), 'Основной объект'),
    COALESCE(NULLIF(TRIM(c.object_address), ''), NULLIF(TRIM(c.legal_address), ''), NULLIF(TRIM(c.actual_address), '')),
    c.activity_type,
    c.sampling_location,
    c.comment,
    CASE WHEN c.status = 'ARCHIVED' THEN 'ARCHIVED' ELSE 'ACTIVE' END,
    TRUE,
    NOW(),
    NOW()
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM company_objects o WHERE o.company_id = c.id);

-- 2) Companies that already had object rows but none flagged primary: promote their
--    oldest (lowest id) object to primary, so every company ends up with exactly one.
UPDATE company_objects o
JOIN (
    SELECT MIN(id) AS first_id, company_id
    FROM company_objects
    WHERE company_id IN (
        SELECT company_id FROM company_objects GROUP BY company_id HAVING SUM(is_primary) = 0
    )
    GROUP BY company_id
) first_per_company ON first_per_company.first_id = o.id
SET o.is_primary = TRUE;

-- 3) MySQL-safe partial-unique-index emulation: NULL unless is_primary=1, so only the "one
--    primary per company" invariant is constrained (unlimited non-primary rows stay allowed).
CALL eco_v26_add_col_if_missing('company_objects', 'primary_marker',
    'BIGINT GENERATED ALWAYS AS (IF(is_primary = 1, company_id, NULL)) STORED');
CALL eco_v26_create_index_if_missing('company_objects', 'ux_company_objects_primary', 'primary_marker', TRUE);

CALL eco_v26_create_index_if_missing('company_objects', 'idx_company_objects_status', 'status', FALSE);

DROP PROCEDURE IF EXISTS eco_v26_add_col_if_missing;
DROP PROCEDURE IF EXISTS eco_v26_create_index_if_missing;
