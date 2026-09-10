-- Adds structured, header-level (one-per-protocol) columns for the type-specific condition
-- fields collected by the quick-create wizard's "conditions" object (QuickCreateConditions).
-- Previously season/workCategory/workplaceType/roomType/normLevel were silently dropped
-- (listed in ProtocolResultValuesMapper.KNOWN_VALUE_KEYS with no actual field mapping), and
-- lightingType/noiseType/visualWorkCategory/waterType/waterUseCategory/samplingDepth only
-- survived as freeform values_json on a per-result-row basis despite being protocol-wide data
-- duplicated onto every row. factorType is intentionally NOT added here: it already has a real
-- per-row column (protocol_results.subtype).
-- Same MySQL-safe idempotent add-column pattern as V16/V29/V31/V33/V53/V60.
--
-- NOTE (integration risk): this is workstream-local V62, chosen because V61 was the highest
-- version present when this workstream started. Two other concurrent worktrees (PEK,
-- document-flow) are independently proposing their own next-free Flyway version off the same
-- V61 baseline. Whichever branch merges last will very likely need this migration (and/or
-- theirs) renumbered before all three land on master together - this is a known, unresolved
-- integration risk, not something this migration can pre-empt on its own.

DELIMITER //

CREATE PROCEDURE eco_v62_add_col_if_missing(
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

DELIMITER ;

CALL eco_v62_add_col_if_missing('protocol_environment_conditions', 'season', 'VARCHAR(120)');
CALL eco_v62_add_col_if_missing('protocol_environment_conditions', 'work_category', 'VARCHAR(120)');
CALL eco_v62_add_col_if_missing('protocol_environment_conditions', 'room_type', 'VARCHAR(120)');
CALL eco_v62_add_col_if_missing('protocol_environment_conditions', 'workplace_type', 'VARCHAR(120)');
CALL eco_v62_add_col_if_missing('protocol_environment_conditions', 'lighting_type', 'VARCHAR(120)');
CALL eco_v62_add_col_if_missing('protocol_environment_conditions', 'noise_type', 'VARCHAR(120)');
CALL eco_v62_add_col_if_missing('protocol_environment_conditions', 'visual_work_category', 'VARCHAR(120)');
CALL eco_v62_add_col_if_missing('protocol_environment_conditions', 'norm_level', 'VARCHAR(120)');
CALL eco_v62_add_col_if_missing('protocol_environment_conditions', 'sample_number', 'VARCHAR(120)');
CALL eco_v62_add_col_if_missing('protocol_environment_conditions', 'sampling_depth', 'VARCHAR(120)');
CALL eco_v62_add_col_if_missing('protocol_environment_conditions', 'sampling_place', 'VARCHAR(500)');
CALL eco_v62_add_col_if_missing('protocol_environment_conditions', 'water_type', 'VARCHAR(120)');
CALL eco_v62_add_col_if_missing('protocol_environment_conditions', 'water_use_category', 'VARCHAR(120)');

DROP PROCEDURE IF EXISTS eco_v62_add_col_if_missing;
