-- Laboratory settings hardening: FKs that were missing entirely (laboratory_employees ->
-- laboratories/users, laboratories.director_id/laboratory_head_id -> laboratory_employees), plus
-- a unique index on laboratories.bin (nullable-safe: MySQL unique indexes already allow multiple
-- NULLs, so labs with no BIN yet don't collide with each other).
-- Same MySQL-safe helper-procedure pattern as V16/V18/V19/V23/V24 ("ADD COLUMN/CONSTRAINT IF NOT
-- EXISTS" is not supported on real MySQL the way it is on MariaDB/H2).

DELIMITER //

CREATE PROCEDURE eco_v25_add_fk_if_missing(
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

CREATE PROCEDURE eco_v25_create_index_if_missing(
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

CALL eco_v25_add_fk_if_missing('laboratory_employees', 'fk_laboratory_employees_laboratory',
        'FOREIGN KEY (laboratory_id) REFERENCES laboratories(id)');
CALL eco_v25_add_fk_if_missing('laboratory_employees', 'fk_laboratory_employees_user',
        'FOREIGN KEY (user_id) REFERENCES users(id)');
CALL eco_v25_add_fk_if_missing('laboratories', 'fk_laboratories_director_employee',
        'FOREIGN KEY (director_id) REFERENCES laboratory_employees(id)');
CALL eco_v25_add_fk_if_missing('laboratories', 'fk_laboratories_head_employee',
        'FOREIGN KEY (laboratory_head_id) REFERENCES laboratory_employees(id)');

CALL eco_v25_create_index_if_missing('laboratories', 'ux_laboratories_bin', 'bin', TRUE);

DROP PROCEDURE IF EXISTS eco_v25_add_fk_if_missing;
DROP PROCEDURE IF EXISTS eco_v25_create_index_if_missing;
