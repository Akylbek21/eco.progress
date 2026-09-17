-- Module spec §31/§15/§18: supporting indexes for the new counterparty search (name/BIN) and
-- audit-log read endpoint - this pass's other fixes (IDOR, requiresMySignature, counters,
-- availableActions, archive, revocation, public-signing challenge, email delivery) are all
-- query/logic-level and reuse the existing schema, so this migration is index-only. Same
-- MySQL-safe idempotent add-index pattern as V50/V60 (skip if the index already exists).

DELIMITER //

CREATE PROCEDURE eco_v61_create_index_if_missing(
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

-- Counterparty search by name (case-insensitive LIKE) and normalized BIN.
CALL eco_v61_create_index_if_missing('document_flow_counterparties', 'idx_dfcp_name', 'name');
CALL eco_v61_create_index_if_missing('document_flow_counterparties', 'idx_dfcp_normalized_bin', 'normalized_bin');

-- Audit log read endpoint: paginated by document, sorted by created_at, optionally filtered by action.
CALL eco_v61_create_index_if_missing('document_flow_audit_log', 'idx_dfal_document_created', 'document_id, created_at');
CALL eco_v61_create_index_if_missing('document_flow_audit_log', 'idx_dfal_document_action', 'document_id, action');

-- requiresMySignature / signing-counters batch queries (SigningAssignmentRepository) join
-- assignments -> steps -> routes by document_id and filter by user_id/status.
CALL eco_v61_create_index_if_missing('document_flow_signing_assignments', 'idx_dfsa_user_status', 'user_id, status');

DROP PROCEDURE IF EXISTS eco_v61_create_index_if_missing;
