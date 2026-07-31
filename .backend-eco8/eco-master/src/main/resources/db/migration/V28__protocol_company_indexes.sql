-- Companies module performance pass: lab_protocols.company_id/object_id had no index at all,
-- so CompanyRepository/ProtocolRepository's per-company protocol lookups (existsByCompanyId,
-- countByCompanyId, findLastProtocolDateByCompanyId - all used by the company card's statistics)
-- were full table scans. Same MySQL-safe idempotent-index-creation pattern as V16/V18/.../V27.
DELIMITER //

CREATE PROCEDURE eco_v28_create_index_if_missing(
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

CALL eco_v28_create_index_if_missing('lab_protocols', 'idx_lab_protocols_company_id', 'company_id');
CALL eco_v28_create_index_if_missing('lab_protocols', 'idx_lab_protocols_object_id', 'object_id');

DROP PROCEDURE IF EXISTS eco_v28_create_index_if_missing;
