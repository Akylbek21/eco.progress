-- Реквизиты официальной сдачи отчёта ПЭК (ТЗ P1, пп.22-26).
--
-- Причина: у отчёта был только submitted_at, проставляемый при переходе статуса SIGNED → SUBMITTED.
-- Это внутренний переход рабочего процесса, а не доказательство того, что подписанный отчёт
-- действительно попал к регулятору: где, когда, каким способом, под каким регистрационным номером
-- и с каким подтверждающим документом - нигде не хранилось. Автоматической отправки в госпортал нет
-- (официального внешнего API не существует), поэтому фиксация ручная - см. PekSubmissionMethod.
--
-- Безопасность для существующих данных: все колонки nullable и без DEFAULT, поэтому существующие
-- отчёты остаются валидными (MySQL заполнит NULL). Ни одна строка не переписывается, ничего не
-- удаляется, ранее применённые миграции не изменяются.
--
-- Идемпотентность: MySQL не поддерживает ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
-- Используется PREPARE/EXECUTE с проверкой information_schema - намеренно без DELIMITER и без
-- CREATE PROCEDURE: разбор DELIMITER-блоков зависит от парсера Flyway, а эти четыре обычных
-- statement'а на колонку разбираются штатно. Повторный прогон на схеме, где колонка уже есть
-- (например, созданная Hibernate ddl-auto=update), выполняет SELECT 1 и ничего не меняет.

-- submission_method: EGOV_PORTAL / EMAIL / PAPER / COURIER / OTHER.
-- VARCHAR, а не нативный MySQL ENUM - в проекте enum-колонки всегда отображаются в VARCHAR
-- (см. V110), иначе добавление значения в Java-enum потребовало бы ALTER TABLE.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'submission_method') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN submission_method VARCHAR(24) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'registration_number') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN registration_number VARCHAR(120) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'submission_comment') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN submission_comment TEXT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Идентификатор файла в общем хранилище (kz.eco.storage), не путь и не имя файла.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'confirmation_file_id') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN confirmation_file_id VARCHAR(64) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Кто зафиксировал сдачу - не обязательно тот, кто подписывал отчёт.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'submitted_by') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN submitted_by BIGINT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'submission_recorded_at') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN submission_recorded_at DATETIME NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'submission_updated_at') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN submission_updated_at DATETIME NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Поиск отчёта по регистрационному номеру - типовой запрос при сверке с регулятором.
-- Не UNIQUE: номер присваивает внешняя сторона, гарантировать его уникальность мы не можем.
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.STATISTICS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND INDEX_NAME = 'idx_pek_reports_registration_number') > 0,
              'SELECT 1',
              'CREATE INDEX idx_pek_reports_registration_number ON pek_reports (registration_number)');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
