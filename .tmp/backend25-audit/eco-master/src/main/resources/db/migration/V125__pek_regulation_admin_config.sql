-- Item 1/3 of the "PEK settings" module fix: admin-editable, DB-backed regulation-version
-- reference book and submission-deadline rule table, replacing the hardcoded lists that used to
-- live in PekRegulationVersionService/PekSubmissionDeadlineService. Global (not tenant-scoped) -
-- there is exactly one nation-wide regulation catalog, not one per company.
--
-- "Only one ACTIVE version at a time" (item 1) is enforced in PekRegulationAdminService
-- (transactionally: activating a version archives the previous ACTIVE one in the same
-- transaction), not by a DB constraint - MySQL has no partial/filtered unique index to express
-- "unique where status = ACTIVE" the way Postgres does.

CREATE TABLE pek_regulation_versions (
    id                       BIGINT        NOT NULL AUTO_INCREMENT,
    code                     VARCHAR(60)   NOT NULL,
    title                    VARCHAR(255)  NOT NULL,
    base_order               VARCHAR(500)  NOT NULL,
    revision_order           VARCHAR(500),
    effective_from           DATE          NOT NULL,
    effective_to             DATE,
    program_template_version VARCHAR(40)   NOT NULL,
    report_template_version  VARCHAR(40)   NOT NULL,
    status                   VARCHAR(20)   NOT NULL,
    created_by               BIGINT,
    created_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by               BIGINT,
    updated_at               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    version                  BIGINT        NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pek_regulation_version_code (code)
);

CREATE TABLE pek_submission_deadline_rules (
    id                      BIGINT        NOT NULL AUTO_INCREMENT,
    report_type             VARCHAR(40)   NOT NULL,
    regulation_code         VARCHAR(60)   NOT NULL,
    months_after_period_end INTEGER       NOT NULL,
    description              VARCHAR(500),
    active                   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by               BIGINT,
    created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by               BIGINT,
    updated_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    version                  BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pek_deadline_rule_type_regulation (report_type, regulation_code),
    CONSTRAINT fk_pek_deadline_rule_regulation FOREIGN KEY (regulation_code)
        REFERENCES pek_regulation_versions (code)
);

-- Seed: exact same two editions and six deadline rules that used to be hardcoded, so behavior is
-- byte-for-byte identical immediately after this migration runs.
INSERT INTO pek_regulation_versions
    (code, title, base_order, revision_order, effective_from, effective_to,
     program_template_version, report_template_version, status)
VALUES
    ('PEK_RULES_250_2021', 'Правила №250',
     'Приказ МЭГПР РК от 14.07.2021 №250 (зарегистрирован в Минюсте РК №23553)', NULL,
     '2021-07-14', '2026-04-18', 'v1-legacy', 'v1-legacy', 'ARCHIVED'),
    ('PEK_RULES_250_2026_59', 'Правила №250',
     'Приказ МЭГПР РК от 14.07.2021 №250 (зарегистрирован в Минюсте РК №23553)',
     CONCAT('Приказ Министра экологии и природных ресурсов РК от 30.03.2026 №59',
        ' (зарегистрирован в Минюсте РК №38268 от 01.04.2026, опубликован 08.04.2026, введён в действие 19.04.2026)'),
     '2026-04-19', NULL, 'v2-2026', 'v2-2026', 'ACTIVE');

INSERT INTO pek_submission_deadline_rules (report_type, regulation_code, months_after_period_end, description, active)
VALUES
    ('PEK_QUARTERLY', 'PEK_RULES_250_2026_59', 2, 'до 1 числа второго месяца, следующего за отчётным кварталом', TRUE),
    ('PEK_TABLES_7_12_ANNUAL', 'PEK_RULES_250_2026_59', 3,
     'до 1 числа третьего месяца, следующего за отчётным периодом (таблицы 7 и 12 формы ПЭК, ежегодно)', TRUE),
    ('PEM_CASPIAN_ANNUAL', 'PEK_RULES_250_2026_59', 3,
     'до 1 числа третьего месяца, следующего за отчётным периодом (ПЭМ, казахстанская часть Каспийского моря, ежегодно)', TRUE),
    ('PEK_QUARTERLY', 'PEK_RULES_250_2021', 2, 'до 1 числа второго месяца, следующего за отчётным кварталом', TRUE),
    ('PEK_TABLES_7_12_ANNUAL', 'PEK_RULES_250_2021', 3,
     'до 1 числа третьего месяца, следующего за отчётным периодом (таблицы 7 и 12 формы ПЭК, ежегодно)', TRUE),
    ('PEM_CASPIAN_ANNUAL', 'PEK_RULES_250_2021', 3,
     'до 1 числа третьего месяца, следующего за отчётным периодом (ПЭМ, казахстанская часть Каспийского моря, ежегодно)', TRUE);
