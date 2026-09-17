-- Официальный ПЭК-отчёт: строки результата, привязанные к protocol_results, плюс фактическая
-- мощность и snapshot лаборатории на уровне отчёта (не программы).
--
-- pek_report_result_rows - вычисляемая (materialized) таблица: PekReportCollectionService.collect()
-- полностью пересобирает набор строк отчёта при каждом запуске (delete+insert), это не
-- пользовательский ввод. Одна строка на protocol_result_id в рамках отчёта.
--
-- pek_reports.actual_capacity(_unit) - фактическая мощность относится к конкретному отчётному
-- периоду, а не к программе на годы вперёд; design_capacity остаётся на pek_programs без изменений.
-- Существующие программы не переписываются - их actual_capacity (свободный текст) остаётся как есть,
-- новое поле на отчёте просто ещё не заполнено (NULL) для уже существующих отчётов.
--
-- pek_reports.laboratory_*_snapshot - фиксируется один раз (первым сбором с определённой
-- лабораторией) и больше не меняется, даже если карточка лаборатории потом редактируется.
--
-- Все новые колонки NULL-допустимые, ничего не удаляется и не переименовывается.

CREATE TABLE IF NOT EXISTS pek_report_result_rows (
    id                   BIGINT        NOT NULL AUTO_INCREMENT,
    report_id            BIGINT        NOT NULL,
    section_type         VARCHAR(30)   NOT NULL,
    monitoring_type      VARCHAR(30),
    control_item_id      BIGINT,
    monitoring_point_id  BIGINT,
    emission_source_id   BIGINT,
    water_outlet_id      BIGINT,
    waste_source_id      BIGINT,
    program_indicator_id BIGINT,
    protocol_id          BIGINT        NOT NULL,
    protocol_result_id   BIGINT        NOT NULL,
    indicator_name       VARCHAR(255),
    indicator_code       VARCHAR(60),
    measurement_date     DATE,
    measurement_method   VARCHAR(255),
    unit                 VARCHAR(40),
    normative_value      NUMERIC(20, 6),
    normative_unit       VARCHAR(40),
    normative_gs         NUMERIC(20, 6),
    normative_tons_year  NUMERIC(20, 6),
    actual_value         NUMERIC(20, 6),
    actual_gs            NUMERIC(20, 6),
    actual_tons_quarter  NUMERIC(20, 6),
    actual_tons_year     NUMERIC(20, 6),
    exceedance           BOOLEAN       NOT NULL DEFAULT FALSE,
    exceedance_ratio     NUMERIC(10, 4),
    corrective_action    VARCHAR(1000),
    comment              VARCHAR(1000),
    source_type          VARCHAR(20),
    source_version       BIGINT,
    created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_pek_result_row_result UNIQUE (report_id, protocol_result_id),
    CONSTRAINT fk_pek_result_row_report FOREIGN KEY (report_id) REFERENCES pek_reports (id)
);
CREATE INDEX idx_pek_result_row_section ON pek_report_result_rows (report_id, section_type);

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'actual_capacity') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN actual_capacity VARCHAR(120) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'actual_capacity_unit') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN actual_capacity_unit VARCHAR(40) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'laboratory_id_snapshot') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN laboratory_id_snapshot BIGINT NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'laboratory_name_snapshot') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN laboratory_name_snapshot VARCHAR(255) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'laboratory_bin_snapshot') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN laboratory_bin_snapshot VARCHAR(40) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'accreditation_number_snapshot') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN accreditation_number_snapshot VARCHAR(120) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'accreditation_valid_from_snapshot') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN accreditation_valid_from_snapshot DATE NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'accreditation_valid_until_snapshot') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN accreditation_valid_until_snapshot DATE NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_reports'
                 AND COLUMN_NAME = 'accreditation_scope_snapshot') > 0,
              'SELECT 1',
              'ALTER TABLE pek_reports ADD COLUMN accreditation_scope_snapshot VARCHAR(500) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_settings'
                 AND COLUMN_NAME = 'require_official_report_complete') > 0,
              'SELECT 1',
              'ALTER TABLE pek_settings ADD COLUMN require_official_report_complete BOOLEAN NOT NULL DEFAULT FALSE');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
