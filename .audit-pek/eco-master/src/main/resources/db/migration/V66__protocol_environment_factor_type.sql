-- Nullable for existing protocols and non-physical templates.
ALTER TABLE protocol_environment_conditions
    ADD COLUMN factor_type VARCHAR(120);

CREATE INDEX idx_protocol_env_factor_type
    ON protocol_environment_conditions (factor_type);
