-- Внутренние проверки ПЭК: department/unit, периодичность (отдельно от plannedDate - см. entity
-- javadoc), структурированные violations/correctiveActions поверх существующих findings/
-- correctiveActionRequired. Все новые колонки NULL-допустимые, существующие данные не затрагиваются.

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_program_internal_inspections'
                 AND COLUMN_NAME = 'department') > 0,
              'SELECT 1',
              'ALTER TABLE pek_program_internal_inspections ADD COLUMN department VARCHAR(255) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_program_internal_inspections'
                 AND COLUMN_NAME = 'frequency_type') > 0,
              'SELECT 1',
              'ALTER TABLE pek_program_internal_inspections ADD COLUMN frequency_type VARCHAR(20) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_program_internal_inspections'
                 AND COLUMN_NAME = 'violations') > 0,
              'SELECT 1',
              'ALTER TABLE pek_program_internal_inspections ADD COLUMN violations TEXT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_program_internal_inspections'
                 AND COLUMN_NAME = 'corrective_actions') > 0,
              'SELECT 1',
              'ALTER TABLE pek_program_internal_inspections ADD COLUMN corrective_actions TEXT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
