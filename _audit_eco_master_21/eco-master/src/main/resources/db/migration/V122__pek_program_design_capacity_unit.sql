-- Программа ПЭК: фактическая мощность (actualCapacity) больше не относится к программе - она
-- переехала на pek_reports (см. V121). Здесь только добавляем designCapacityUnit; колонка
-- pek_programs.actual_capacity НЕ удаляется и НЕ переименовывается - историческая программа не
-- теряет ранее сохранённые данные, просто приложение больше не читает/не пишет эту колонку.
--
-- design_capacity_unit - новая, nullable колонка. Существующие значения design_capacity (свободный
-- текст вида "120 т/год") не разбираются и не переписываются - PekProgram.designCapacity
-- сохраняет то, что в нём уже было; только новые/отредактированные программы получают отдельную
-- единицу измерения.

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.COLUMNS
               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pek_programs'
                 AND COLUMN_NAME = 'design_capacity_unit') > 0,
              'SELECT 1',
              'ALTER TABLE pek_programs ADD COLUMN design_capacity_unit VARCHAR(40) NULL');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
