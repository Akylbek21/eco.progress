-- Полный комплект ПЭК: пояснительная записка, отчёт о природоохранных мероприятиях и официальная
-- таблица выбросов как самостоятельные версионируемые документы отчёта.
--
-- На проде схема строится ddl-auto (Flyway там не запускался): Hibernate добавит новые таблицы и
-- колонки сам, но НЕ расширит pek_report_document_versions.document_type с VARCHAR(20) - а
-- ENVIRONMENTAL_MEASURES длиннее 20 символов. Этот ALTER нужно выполнить на проде вручную.

ALTER TABLE pek_report_document_versions MODIFY COLUMN document_type VARCHAR(40) NOT NULL DEFAULT 'OFFICIAL';
ALTER TABLE pek_report_document_versions ADD COLUMN xlsx_file_id VARCHAR(64);
ALTER TABLE pek_report_document_versions ADD COLUMN source_program_content_revision BIGINT;

ALTER TABLE pek_programs ADD COLUMN technological_process TEXT;
ALTER TABLE pek_programs ADD COLUMN main_impact_sources TEXT;

ALTER TABLE pek_reports ADD COLUMN performed_studies TEXT;
ALTER TABLE pek_reports ADD COLUMN monitoring_results_summary TEXT;
ALTER TABLE pek_reports ADD COLUMN exceedances_summary TEXT;
ALTER TABLE pek_reports ADD COLUMN measures_taken TEXT;
ALTER TABLE pek_reports ADD COLUMN conclusion TEXT;

ALTER TABLE pek_program_measures ADD COLUMN work_volume VARCHAR(1000);
ALTER TABLE pek_program_measures ADD COLUMN environmental_effect VARCHAR(2000);

CREATE TABLE pek_report_measure_executions (
    id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_id             BIGINT         NOT NULL,
    measure_id            BIGINT         NOT NULL,
    actual_amount         DECIMAL(18, 2),
    completion_percent    DECIMAL(5, 2),
    status                VARCHAR(20)    NOT NULL,
    note                  VARCHAR(2000),
    non_completion_reason VARCHAR(2000),
    updated_by            BIGINT,
    updated_at            DATETIME(6)    NOT NULL,
    version               BIGINT         NOT NULL,
    CONSTRAINT uk_pek_report_measure_execution UNIQUE (report_id, measure_id)
);

CREATE TABLE pek_report_emission_balances (
    id                     BIGINT AUTO_INCREMENT PRIMARY KEY,
    report_id              BIGINT         NOT NULL,
    emission_source_id     BIGINT         NOT NULL,
    substance_code         VARCHAR(60)    NOT NULL,
    without_treatment_tons DECIMAL(18, 6),
    captured_tons          DECIMAL(18, 6),
    utilized_tons          DECIMAL(18, 6),
    increase_reason        VARCHAR(2000),
    updated_by             BIGINT,
    updated_at             DATETIME(6)    NOT NULL,
    version                BIGINT         NOT NULL,
    CONSTRAINT uk_pek_report_emission_balance UNIQUE (report_id, emission_source_id, substance_code)
);
