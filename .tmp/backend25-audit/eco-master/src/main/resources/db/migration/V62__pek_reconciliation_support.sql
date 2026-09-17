-- PEK reconciliation support (module spec, "PEK reconciliation" pass - see
-- PekReportCollectionService#collect rewrite). This migration is deliberately small: match_status,
-- match_type, manual, excluded and source_version already exist on pek_report_protocol_sources
-- (added by V36/V56) and are NOT redefined here. PekMatchStatus gains two new Java enum constants
-- (UNMATCHED, AMBIGUOUS) alongside the existing MATCHED/MANUAL/EXCLUDED - since match_status is
-- stored as a plain VARCHAR(20) (@Enumerated(EnumType.STRING)), no column change is needed for
-- that; VARCHAR(20) already comfortably fits "UNMATCHED"/"AMBIGUOUS".
--
-- What IS added: read-path indexes the new reconciliation pass and the sources-listing endpoint
-- (GET /api/pek/reports/{id}/sources) actually filter/join on. Deliberately NOT duplicating
-- coverage that already exists:
--   - (report_id) alone: already covered by idx_pek_rps_report (V36).
--   - (report_id, protocol_id): already covered as the leading two columns of the unique index
--     uk_pek_report_protocol_source_real (report_id, protocol_id, protocol_result_key) from V56 -
--     MySQL can use a composite index's leading-column prefix for a lookup on just those two
--     columns, so a second index would be pure duplication.
-- What's missing and is added below:
--   - (report_id, match_status): the reconciliation summary and the sources-listing endpoint both
--     filter by report_id + match_status (e.g. "give me all AMBIGUOUS rows for this report").
--   - (report_id, excluded): read paths (plan/fact source lookups, sources-listing) filter by
--     report_id + excluded=false together; idx_pek_rps_report alone forces a table-range scan
--     filtered in memory for the excluded flag.
--   - (protocol_id, protocol_result_id): the reconciliation pass looks up, per actual protocol
--     result, whether an existing source row for that (protocol_id, protocol_result_id) pair is
--     still valid - idx_pek_rps_protocol (protocol_id alone, V36) does not cover the second column.
--
-- Same MySQL-safe idempotent-index helper-procedure pattern as V18/V19/V20/V21 ("CREATE INDEX IF
-- NOT EXISTS" is MariaDB-only and fails on real MySQL 8.x, this project's actual target - see
-- application-docker.properties).
DELIMITER //

CREATE PROCEDURE eco_v62_create_index_if_missing(
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

CALL eco_v62_create_index_if_missing('pek_report_protocol_sources',
    'idx_pek_rps_report_match_status', 'report_id, match_status');
CALL eco_v62_create_index_if_missing('pek_report_protocol_sources',
    'idx_pek_rps_report_excluded', 'report_id, excluded');
CALL eco_v62_create_index_if_missing('pek_report_protocol_sources',
    'idx_pek_rps_protocol_result', 'protocol_id, protocol_result_id');

DROP PROCEDURE IF EXISTS eco_v62_create_index_if_missing;
