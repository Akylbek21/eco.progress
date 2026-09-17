-- Idempotency support for POST /api/protocols/quick-create: a client-supplied Idempotency-Key
-- header lets a double-click or a client retry after a network timeout be recognized as the same
-- logical request instead of creating a second protocol. Each (user_id, idempotency_key) pair maps
-- to at most one row; request_hash (SHA-256 hex of the request body) detects the case where the
-- same key gets reused for a genuinely different request body, which is treated as a client error
-- rather than silently returning the old result. protocol_id is null while status=PROCESSING and
-- filled in once the underlying quick-create call finishes (COMPLETED) or is cleared to retry
-- (FAILED). See kz.eco.protocol.idempotency.ProtocolIdempotencyService for the state machine.
--
-- Flyway's plain CREATE TABLE IF NOT EXISTS is safe on MySQL (unlike ADD COLUMN IF NOT EXISTS,
-- which MySQL doesn't support at all), so the table itself uses that directly. Indexes still use
-- the same MySQL-safe idempotent stored-procedure pattern as V16/V29/V31/etc., since CREATE INDEX
-- has no native IF NOT EXISTS guard on MySQL either.

CREATE TABLE IF NOT EXISTS protocol_idempotency_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    protocol_id BIGINT NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_protocol_idempotency UNIQUE (user_id, idempotency_key)
);

DELIMITER //

CREATE PROCEDURE eco_v32_create_index_if_missing(
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

-- Supports a periodic cleanup job trimming old PROCESSING/COMPLETED/FAILED rows past their
-- useful window, and lookups from a protocol back to the idempotency request that created it.
CALL eco_v32_create_index_if_missing('protocol_idempotency_requests', 'idx_protocol_idempotency_created_at', 'created_at');
CALL eco_v32_create_index_if_missing('protocol_idempotency_requests', 'idx_protocol_idempotency_protocol_id', 'protocol_id');

DROP PROCEDURE IF EXISTS eco_v32_create_index_if_missing;
