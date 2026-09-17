-- Fixes silent data loss: these keys were already accepted by the API (whitelisted in
-- ProtocolResultValuesMapper.KNOWN_VALUE_KEYS) but had no backing column, so a client sending
-- them got no error and the value was simply discarded on every request.
ALTER TABLE protocol_results ADD COLUMN avg_value DECIMAL(20,6) NULL;
ALTER TABLE protocol_results ADD COLUMN cas_number VARCHAR(40) NULL;
ALTER TABLE protocol_results ADD COLUMN formula VARCHAR(80) NULL;
ALTER TABLE protocol_results ADD COLUMN normative_document VARCHAR(300) NULL;
ALTER TABLE protocol_results ADD COLUMN duration_minutes INT NULL;
