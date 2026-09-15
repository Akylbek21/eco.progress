-- Item 4 of the PEK settings module fix: per-regulation-version admin configuration of the 9
-- official table types (mandatory/applicable/displayOrder/periodicity/requiredFields). This is
-- METADATA layered on top of PekOfficialReportDataService#applicableTableTypes, which keeps
-- deciding actual per-program applicability from the program's declared monitoring directions
-- (that logic is well-tested and untouched) - this table supplies the properties that logic has
-- no way to express: display order, submission periodicity, and a human-readable required-field
-- list for the admin page / frontend to show, without changing what readiness blocks on.

CREATE TABLE pek_official_table_configs (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    regulation_code   VARCHAR(60)  NOT NULL,
    table_type        VARCHAR(40)  NOT NULL,
    mandatory         BOOLEAN      NOT NULL DEFAULT TRUE,
    applicable        BOOLEAN      NOT NULL DEFAULT TRUE,
    display_order     INTEGER      NOT NULL,
    periodicity       VARCHAR(20)  NOT NULL DEFAULT 'QUARTERLY',
    required_fields   VARCHAR(1000),
    created_by        BIGINT,
    created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        BIGINT,
    updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    version           BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pek_official_table_config (regulation_code, table_type),
    CONSTRAINT fk_pek_official_table_config_regulation FOREIGN KEY (regulation_code)
        REFERENCES pek_regulation_versions (code)
);

-- Seed defaults for the currently ACTIVE edition, mirroring the enum declaration order (item 3
-- research: enum order already matches the spec's listed table order) and the required-field sets
-- PekOfficialReportDataService#officialReadinessIssues already enforces in code.
INSERT INTO pek_official_table_configs
    (regulation_code, table_type, mandatory, applicable, display_order, periodicity, required_fields)
VALUES
    ('PEK_RULES_250_2026_59', 'EMISSIONS', TRUE, TRUE, 1, 'QUARTERLY', 'normativeValue,actualValue,unit,emissionSourceId'),
    ('PEK_RULES_250_2026_59', 'INSTRUMENTAL_MEASUREMENTS', TRUE, TRUE, 2, 'QUARTERLY', 'normativeValue,actualValue,unit'),
    ('PEK_RULES_250_2026_59', 'CALCULATED_EMISSIONS', TRUE, TRUE, 3, 'QUARTERLY', 'normativeValue,actualValue,unit,emissionSourceId'),
    ('PEK_RULES_250_2026_59', 'AMBIENT_AIR', TRUE, TRUE, 4, 'QUARTERLY', 'normativeValue,actualValue,unit,monitoringPointId'),
    ('PEK_RULES_250_2026_59', 'WASTEWATER', TRUE, TRUE, 5, 'QUARTERLY', 'normativeValue,actualValue,unit,waterOutletId'),
    ('PEK_RULES_250_2026_59', 'WATER', TRUE, TRUE, 6, 'QUARTERLY', 'normativeValue,actualValue,unit,monitoringPointId'),
    ('PEK_RULES_250_2026_59', 'SOIL', TRUE, TRUE, 7, 'QUARTERLY', 'normativeValue,actualValue,unit,monitoringPointId'),
    ('PEK_RULES_250_2026_59', 'RADIATION', TRUE, TRUE, 8, 'QUARTERLY', 'normativeValue,actualValue,unit'),
    ('PEK_RULES_250_2026_59', 'MARINE', TRUE, TRUE, 9, 'ANNUAL', 'normativeValue,actualValue,unit,waterOutletId');
