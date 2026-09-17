-- Создание программы ПЭК: три поля формы не имели ни колонки, ни поля сущности, ни поля DTO -
-- запрос их приносил, backend отвечал 200 и молча их терял (см. PekProgram / FacilitySnapshotDto).
--
-- Все три nullable и без DEFAULT: миграция безопасна для существующих строк (MySQL заполняет их
-- NULL), обратно совместима с текущим кодом и не переписывает никакие данные.
ALTER TABLE pek_programs
    ADD COLUMN actual_capacity  VARCHAR(255) NULL,
    ADD COLUMN monitoring_scope TEXT         NULL,
    ADD COLUMN readiness_notes  TEXT         NULL;
