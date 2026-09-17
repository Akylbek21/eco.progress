-- Раздел «Нормативы»: audit-поля записи и данные для безопасного rollback импорта.
--
-- normative_records.created_by / updated_by - кто создал / последним изменил запись.
-- normative_records.replaced_record_id      - предыдущая версия, которую импорт деактивировал;
--   без неё rollback мог только погасить новую версию, оставив показатель вообще без норматива.
-- normative_import_batches.file_hash        - SHA-256 файла preview: confirm применяет только
--   провалидированный файл.
-- normative_import_batches.skipped_rows / rolled_back_at / rolled_back_by - статус и audit импорта.
--
-- Все новые колонки nullable (кроме skipped_rows с DEFAULT 0), существующие строки не
-- переписываются. Идемпотентно через information_schema, без DELIMITER (см. V119).

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'normative_records'
                 AND COLUMN_NAME = 'created_by') > 0,
              'SELECT 1',
              'ALTER TABLE normative_records ADD COLUMN created_by BIGINT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'normative_records'
                 AND COLUMN_NAME = 'updated_by') > 0,
              'SELECT 1',
              'ALTER TABLE normative_records ADD COLUMN updated_by BIGINT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'normative_records'
                 AND COLUMN_NAME = 'replaced_record_id') > 0,
              'SELECT 1',
              'ALTER TABLE normative_records ADD COLUMN replaced_record_id BIGINT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'normative_records'
                 AND INDEX_NAME = 'idx_nr_import_batch') > 0,
              'SELECT 1',
              'CREATE INDEX idx_nr_import_batch ON normative_records (import_batch_id)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'normative_records'
                 AND INDEX_NAME = 'idx_nr_replaced_record') > 0,
              'SELECT 1',
              'CREATE INDEX idx_nr_replaced_record ON normative_records (replaced_record_id)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'normative_import_batches'
                 AND COLUMN_NAME = 'file_hash') > 0,
              'SELECT 1',
              'ALTER TABLE normative_import_batches ADD COLUMN file_hash VARCHAR(64) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'normative_import_batches'
                 AND COLUMN_NAME = 'skipped_rows') > 0,
              'SELECT 1',
              'ALTER TABLE normative_import_batches ADD COLUMN skipped_rows INT NOT NULL DEFAULT 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'normative_import_batches'
                 AND COLUMN_NAME = 'rolled_back_at') > 0,
              'SELECT 1',
              'ALTER TABLE normative_import_batches ADD COLUMN rolled_back_at DATETIME(6) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'normative_import_batches'
                 AND COLUMN_NAME = 'rolled_back_by') > 0,
              'SELECT 1',
              'ALTER TABLE normative_import_batches ADD COLUMN rolled_back_by BIGINT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
