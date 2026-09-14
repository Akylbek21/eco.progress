-- P0: официальные таблицы отчёта нечем было наполнить. Источники выбросов, выпуски сточных вод и
-- отходы существовали только как emission_source_id / water_outlet_id / waste_source_id на
-- pek_program_control_items - ссылки в никуда, без собственных сущностей. Ни высоту трубы, ни
-- водоприёмник, ни лимит и срок накопления отхода записать было негде.
--
-- Каталог отходов и движение за период разделены намеренно: вид/код/класс/лимит/срок - это то, что
-- заявляет программа, а остаток/образование/передача/получатель - факт конкретного отчётного
-- периода. Слияние в одну таблицу означало бы либо переписывание программных данных каждый квартал,
-- либо дублирование каталога на каждый отчёт.
--
-- Все таблицы новые, существующие данные не затрагиваются.

CREATE TABLE IF NOT EXISTS pek_emission_sources (
    id                          BIGINT        NOT NULL AUTO_INCREMENT,
    program_id                  BIGINT        NOT NULL,
    code                        VARCHAR(60)   NOT NULL,
    name                        VARCHAR(255)  NOT NULL,
    source_type                 VARCHAR(60),
    workshop_name               VARCHAR(255),
    height_m                    NUMERIC(12, 3),
    diameter_m                  NUMERIC(12, 3),
    coordinates                 VARCHAR(120),
    gas_cleaning_equipment      VARCHAR(500),
    cleaning_efficiency_percent NUMERIC(6, 3),
    operating_hours_per_year    INTEGER,
    description                 VARCHAR(2000),
    sort_order                  INTEGER       NOT NULL DEFAULT 0,
    created_at                  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version                     BIGINT        NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_pek_emission_source_program
        FOREIGN KEY (program_id) REFERENCES pek_programs (id)
);
CREATE INDEX idx_pek_emission_sources_program ON pek_emission_sources (program_id, sort_order);

CREATE TABLE IF NOT EXISTS pek_discharge_sources (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    program_id           BIGINT       NOT NULL,
    code                 VARCHAR(60)  NOT NULL,
    name                 VARCHAR(255) NOT NULL,
    receiving_water_body VARCHAR(255),
    discharge_type       VARCHAR(120),
    coordinates          VARCHAR(120),
    permitted_volume     NUMERIC(18, 4),
    volume_unit          VARCHAR(40),
    treatment_facilities VARCHAR(500),
    description          VARCHAR(2000),
    sort_order           INTEGER      NOT NULL DEFAULT 0,
    created_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version              BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_pek_discharge_source_program
        FOREIGN KEY (program_id) REFERENCES pek_programs (id)
);
CREATE INDEX idx_pek_discharge_sources_program ON pek_discharge_sources (program_id, sort_order);

CREATE TABLE IF NOT EXISTS pek_waste_items (
    id                       BIGINT       NOT NULL AUTO_INCREMENT,
    program_id               BIGINT       NOT NULL,
    name                     VARCHAR(500) NOT NULL,
    code                     VARCHAR(60),
    hazard_class             VARCHAR(60),
    accumulation_limit       NUMERIC(18, 4),
    limit_unit               VARCHAR(40),
    accumulation_period_days INTEGER,
    storage_site_name        VARCHAR(255),
    coordinates              VARCHAR(120),
    description              VARCHAR(2000),
    sort_order               INTEGER      NOT NULL DEFAULT 0,
    created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version                  BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT fk_pek_waste_item_program
        FOREIGN KEY (program_id) REFERENCES pek_programs (id)
);
CREATE INDEX idx_pek_waste_items_program ON pek_waste_items (program_id, sort_order);

-- generated_amount, а не generated: GENERATED - зарезервированное слово в MySQL 8.
CREATE TABLE IF NOT EXISTS pek_report_waste_movements (
    id               BIGINT    NOT NULL AUTO_INCREMENT,
    report_id        BIGINT    NOT NULL,
    waste_item_id    BIGINT    NOT NULL,
    opening_balance  NUMERIC(18, 4),
    generated_amount NUMERIC(18, 4),
    transferred      NUMERIC(18, 4),
    disposed         NUMERIC(18, 4),
    closing_balance  NUMERIC(18, 4),
    receiver_name    VARCHAR(500),
    receiver_bin     VARCHAR(12),
    note             VARCHAR(2000),
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version          BIGINT    NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_pek_waste_movement_report_item UNIQUE (report_id, waste_item_id),
    CONSTRAINT fk_pek_waste_movement_report
        FOREIGN KEY (report_id) REFERENCES pek_reports (id),
    CONSTRAINT fk_pek_waste_movement_item
        FOREIGN KEY (waste_item_id) REFERENCES pek_waste_items (id)
);
