-- Root-cause fix for the quick-create 409: ProtocolNumberGenerator used to read
-- MAX(protocol_number) and increment it with zero locking, inside the same transaction as the
-- protocol INSERT. Two callers (a double-click, or two genuinely concurrent requests) could both
-- read the same "last" row before either committed, compute the same next number, and collide on
-- lab_protocols.protocol_number's UNIQUE constraint - surfaced to the client as a generic 409
-- "Конфликт данных". protocol_number_counters + a pessimistic row lock
-- (ProtocolNumberCounterService.nextValue, REQUIRES_NEW) closes that race: the lock is held only
-- for the few milliseconds it takes to reserve the next sequence value, not for the whole
-- (much longer) protocol-creation transaction. The UNIQUE constraint on
-- lab_protocols.protocol_number remains in place as the last line of defense, not the primary
-- generator, per the design.
--
-- Before relying on this migration in a real environment, check for pre-existing duplicates that
-- would indicate the old race already produced bad data (this migration does NOT delete or modify
-- any existing lab_protocols row):
--   SELECT protocol_number, COUNT(*) FROM lab_protocols GROUP BY protocol_number HAVING COUNT(*) > 1;
--
-- The counter table starts empty; ProtocolNumberCounterService seeds a (prefix, year)'s first
-- reservation from the true numeric max of any existing lab_protocols rows for that prefix+year
-- (see its createCounterRow()), so pre-existing legacy protocol numbers are never immediately
-- collided with.

CREATE TABLE IF NOT EXISTS protocol_number_counters (
    id BIGINT NOT NULL AUTO_INCREMENT,
    number_prefix VARCHAR(30) NOT NULL,
    protocol_year INT NOT NULL,
    last_value BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_protocol_number_counter UNIQUE (number_prefix, protocol_year)
);

DELIMITER //

CREATE PROCEDURE eco_v33_create_index_if_missing(
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

-- Requested query/listing indexes on lab_protocols - idx_lab_protocols_status, _protocol_number,
-- _laboratory_id, _executor_id, _template_id, _protocol_date and _created_at already exist from
-- V29; company/object indexes did not.
CALL eco_v33_create_index_if_missing('lab_protocols', 'idx_protocol_template_date', 'template_id, protocol_date');
CALL eco_v33_create_index_if_missing('lab_protocols', 'idx_protocol_company', 'company_id');
CALL eco_v33_create_index_if_missing('lab_protocols', 'idx_protocol_object', 'object_id');
CALL eco_v33_create_index_if_missing('lab_protocols', 'idx_protocol_created_at', 'created_at');

DROP PROCEDURE IF EXISTS eco_v33_create_index_if_missing;
