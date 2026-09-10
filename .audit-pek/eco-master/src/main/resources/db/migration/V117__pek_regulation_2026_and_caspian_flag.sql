-- Уточнение нормативной базы по действующей редакции (Adilet) и признак каспийской ПЭМ.
--
-- 1. Реквизиты редакции. В коде и в данных стояла неверная ссылка
--    "Приказ МЭГПР РК от 26.05.2023 №250". Фактически:
--      * базовый НПА  - Приказ МЭГПР РК от 14.07.2021 №250, рег. в Минюсте №23553;
--      * изменение п.23 - Приказ Министра экологии и природных ресурсов РК от 30.03.2026 №59,
--        рег. в Минюсте №38268 от 01.04.2026, опубликован 08.04.2026, введён в действие 19.04.2026.
--
--    Коды справочника: PEK_RULES_250_2021 и PEK_RULES_250_2026_59 вместо PR250_2023.
--    Строки распределяются по дате создания: то, что создано до 19.04.2026, авторствовалось под
--    базовой редакцией, остальное - под редакцией 2026 года. Дата создания - единственный признак,
--    по которому это можно определить, не выдумывая.
--
-- 2. Тип отчёта. Убирается generic PEK_ANNUAL: правила не устанавливают срок для годового отчёта
--    ПЭК как такового - ежегодно подаются таблицы 7 и 12 формы, и отдельно ПЭМ по казахстанской
--    части Каспия. Существующие годовые отчёты переводятся в PEK_TABLES_7_12_ANNUAL.
--    В PEM_CASPIAN_ANNUAL не переводится ничего: признак каспийской ПЭМ появляется только этой
--    миграцией, и определить его задним числом по имеющимся данным нельзя.
--
-- 3. Признак объекта. special_monitoring_type ставится на company_objects, а не на companies:
--    у одной компании могут быть разные объекты, и признак на компании выдал бы каспийский срок
--    всем её объектам сразу. Значение по умолчанию NONE - объект не получает более поздний срок,
--    пока его явно не отметили.
--
-- Уже рассчитанные submission_due_date не пересчитываются: срок, вокруг которого компания уже
-- спланировала работу, не должен уехать из-за миграции.

ALTER TABLE company_objects
    ADD COLUMN special_monitoring_type VARCHAR(40) NOT NULL DEFAULT 'NONE';

UPDATE pek_programs
SET regulation_code = 'PEK_RULES_250_2026_59'
WHERE regulation_code = 'PR250_2023'
  AND created_at >= '2026-04-19 00:00:00';

UPDATE pek_programs
SET regulation_code = 'PEK_RULES_250_2021'
WHERE regulation_code = 'PR250_2023';

UPDATE pek_reports
SET regulation_code = 'PEK_RULES_250_2026_59'
WHERE regulation_code = 'PR250_2023'
  AND created_at >= '2026-04-19 00:00:00';

UPDATE pek_reports
SET regulation_code = 'PEK_RULES_250_2021'
WHERE regulation_code = 'PR250_2023';

-- Отображаемая строка нормативной основы: попадает в шапку формируемых документов, поэтому
-- неверная ссылка на приказ должна исчезнуть и из уже сохранённых строк.
UPDATE pek_programs
SET regulation_version = 'Правила №250 (Приказ МЭГПР РК от 14.07.2021 №250, рег. №23553)'
WHERE regulation_version LIKE '%26.05.2023%';

UPDATE pek_reports
SET regulation_version = 'Правила №250 (Приказ МЭГПР РК от 14.07.2021 №250, рег. №23553)'
WHERE regulation_version LIKE '%26.05.2023%';

UPDATE pek_reports
SET report_type = 'PEK_TABLES_7_12_ANNUAL'
WHERE report_type = 'PEK_ANNUAL';

-- Значение по умолчанию у колонок тоже несёт устаревший код (V115), иначе строка, вставленная в
-- обход приложения, снова получила бы PR250_2023.
ALTER TABLE pek_programs ALTER COLUMN regulation_code SET DEFAULT 'PEK_RULES_250_2021';
ALTER TABLE pek_reports ALTER COLUMN regulation_code SET DEFAULT 'PEK_RULES_250_2021';

-- Ссылка на редакцию 2026 года содержит оба приказа с реквизитами регистрации и датами и не
-- помещается в VARCHAR(120), с которым колонка была заведена (V104/V105). Расширяем до 500 -
-- иначе штамп нормативной основы обрезался бы ровно на официальном документе.
ALTER TABLE pek_programs ALTER COLUMN regulation_version VARCHAR(500) NOT NULL;
ALTER TABLE pek_reports ALTER COLUMN regulation_version VARCHAR(500) NOT NULL;
ALTER TABLE pek_report_document_versions ALTER COLUMN regulation_version VARCHAR(500) NOT NULL;

ALTER TABLE pek_programs
    ALTER COLUMN regulation_version
        SET DEFAULT 'Правила №250 (Приказ МЭГПР РК от 14.07.2021 №250, рег. №23553)';
ALTER TABLE pek_reports
    ALTER COLUMN regulation_version
        SET DEFAULT 'Правила №250 (Приказ МЭГПР РК от 14.07.2021 №250, рег. №23553)';
ALTER TABLE pek_report_document_versions
    ALTER COLUMN regulation_version
        SET DEFAULT 'Правила №250 (Приказ МЭГПР РК от 14.07.2021 №250, рег. №23553)';

-- pek_report_document_versions.regulation_version намеренно НЕ переписывается: это штамп того, что
-- фактически напечатано в уже сформированном и, возможно, подписанном файле. Исправление строки в
-- БД разошлось бы с содержимым документа. Такие версии перевыпускаются заново, а не правятся.
