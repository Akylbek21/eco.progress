-- Universal storage for the 5 laboratory journal types (see JournalType). Each journal type has
-- a different set of columns, so instead of 5 separate tables all entries share one table and
-- keep their type-specific fields in a JSON blob.
--
-- Adapted to MySQL (production/dev target, see docker-compose.yml): BIGINT AUTO_INCREMENT instead
-- of bigserial, JSON instead of JSONB, CURRENT_TIMESTAMP instead of localtimestamp. MySQL has no
-- GIN index; JSON search here goes through LIKE on the JSON text, which is adequate given
-- pagination + the 3-character search minimum enforced by the frontend keep result sets small.
-- Column is named row_num (not row_number) so it needs no dialect-specific quoting: MySQL treats
-- row_number as reserved-word-like and needs backticks (see V1__protocol_module_tables.sql), but
-- backtick-quoting isn't portable to H2 (used in tests), so a plain identifier avoids the clash.
CREATE TABLE IF NOT EXISTS lab_journal_entries (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    journal_type VARCHAR(100) NOT NULL,
    row_num INT,
    entry_date DATE,
    data JSON NOT NULL,
    laboratory_id BIGINT,
    created_by BIGINT,
    updated_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    INDEX idx_lab_journal_type (journal_type),
    INDEX idx_lab_journal_entry_date (entry_date),
    INDEX idx_lab_journal_laboratory (laboratory_id)
);
