-- P0: версия нормативной базы была строкой-константой в коде (PekRegulationVersionService.CURRENT),
-- а срок представления отчёта выводился из periodType, из-за чего любой годовой отчёт получал
-- универсальное "+45 дней" - правило, которого нормативка не устанавливает.
--
-- Вводим два ключа:
--   * regulation_code - код записи справочника версий (PekRegulationVersion). Свободный текст в
--     regulation_version остаётся как есть, для отображения и обратной совместимости; ключом
--     становится код.
--   * report_type - нормативная классификация отчёта, от которой зависит срок представления
--     (PEK_QUARTERLY / PEK_ANNUAL / PEM_CASPIAN_ANNUAL).
--
-- Обе колонки NOT NULL с DEFAULT: существующие строки заполняются без переписывания данных.
-- Никакие уже рассчитанные submission_due_date не пересчитываются - срок, вокруг которого
-- компания уже спланировала работу, не должен задним числом уехать из-за миграции.

ALTER TABLE pek_programs
    ADD COLUMN regulation_code VARCHAR(40) NOT NULL DEFAULT 'PR250_2023';

ALTER TABLE pek_reports
    ADD COLUMN regulation_code VARCHAR(40) NOT NULL DEFAULT 'PR250_2023',
    ADD COLUMN report_type     VARCHAR(40) NOT NULL DEFAULT 'PEK_QUARTERLY';

-- Классификация существующих отчётов по фактическому типу периода. PEM_CASPIAN_ANNUAL здесь не
-- проставляется: признак каспийской ПЭМ-отчётности в данных пока отсутствует, и угадывать его по
-- имеющимся полям нельзя.
UPDATE pek_reports SET report_type = 'PEK_ANNUAL' WHERE period_type = 'YEAR';
UPDATE pek_reports SET report_type = 'PEK_QUARTERLY' WHERE period_type = 'QUARTER';
