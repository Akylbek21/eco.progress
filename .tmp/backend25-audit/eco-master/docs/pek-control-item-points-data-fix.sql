-- Исправление данных: позиции контроля ПЭК без настройки точки мониторинга.
-- Сопровождает V128__pek_control_item_applies_to_all_points.sql. MySQL 8.
--
-- Это НЕ миграция и автоматически не выполняется. Решение, к какой точке относится позиция, - это
-- решение по содержанию программы, по данным его принять нельзя. Сопоставлять позиции и точки по
-- названию тоже нельзя: связь хранится только через id точки.
--
-- Порядок: бэкап -> шаг 0 (колонка есть?) -> шаг 1 (отчёт) -> шаг 2 (явные id) -> шаг 3 (проверка).

-- ----------------------------------------------------------------------------------------------
-- Шаг 0. Колонка. Через Flyway её создаёт V128; на базе, где схему ведёт Hibernate ddl-auto, её
-- создаёт приложение при старте. Если приложение ещё не перезапущено на новой версии:
-- ----------------------------------------------------------------------------------------------
SELECT COUNT(*) AS has_column
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'pek_program_control_items'
  AND column_name = 'applies_to_all_points';
-- если 0:
-- ALTER TABLE pek_program_control_items ADD COLUMN applies_to_all_points BOOLEAN NOT NULL DEFAULT FALSE;

-- ----------------------------------------------------------------------------------------------
-- Шаг 1. Отчёт: какие позиции не настроены и какие точки есть у их направлений.
-- Ничего не меняет. По этому списку ответственный решает, что назначить каждой позиции.
-- ----------------------------------------------------------------------------------------------
SELECT p.id                    AS program_id,
       p.number                AS program_number,
       p.status                AS program_status,
       ci.id                   AS control_item_id,
       ci.code                 AS control_item_code,
       ci.name                 AS control_item_name,
       m.id                    AS monitoring_id,
       m.monitoring_type       AS monitoring_type,
       mp.id                   AS candidate_point_id,
       mp.name                 AS candidate_point_name
FROM pek_program_control_items ci
JOIN pek_programs p                    ON p.id = ci.program_id
LEFT JOIN pek_monitoring_control_items mci ON mci.control_item_id = ci.id
LEFT JOIN pek_program_monitoring m     ON m.id = mci.monitoring_id
LEFT JOIN pek_monitoring_points mp     ON mp.monitoring_id = m.id
WHERE ci.monitoring_point_id IS NULL
  AND ci.applies_to_all_points = FALSE
ORDER BY p.id, ci.sort_order, ci.id, mp.id;

-- ----------------------------------------------------------------------------------------------
-- Шаг 2. Назначение - только явными id из отчёта шага 1.
--
-- Каждый UPDATE проверяет, что точка принадлежит той же программе и одному из направлений, к
-- которым привязана позиция, и что позиция всё ещё не настроена. Если id перепутан, UPDATE
-- изменит 0 строк, а не привяжет позицию к чужой точке. Смотрите "rows affected": ожидается 1.
-- ----------------------------------------------------------------------------------------------

-- 2a. Конкретная точка. Для обращения: "Воздух — северная точка" -> id точки ТК-01,
--     "Воздух — южная точка" -> id точки ТК-02. Подставьте id из шага 1.
UPDATE pek_program_control_items ci
JOIN pek_monitoring_points mp
  ON mp.id = /* id точки ТК-01 */ 0
 AND mp.program_id = ci.program_id
JOIN pek_monitoring_control_items mci
  ON mci.control_item_id = ci.id
 AND mci.monitoring_id = mp.monitoring_id
SET ci.monitoring_point_id = mp.id
WHERE ci.id = /* id позиции "Воздух — северная точка" */ 0
  AND ci.monitoring_point_id IS NULL
  AND ci.applies_to_all_points = FALSE;

UPDATE pek_program_control_items ci
JOIN pek_monitoring_points mp
  ON mp.id = /* id точки ТК-02 */ 0
 AND mp.program_id = ci.program_id
JOIN pek_monitoring_control_items mci
  ON mci.control_item_id = ci.id
 AND mci.monitoring_id = mp.monitoring_id
SET ci.monitoring_point_id = mp.id
WHERE ci.id = /* id позиции "Воздух — южная точка" */ 0
  AND ci.monitoring_point_id IS NULL
  AND ci.applies_to_all_points = FALSE;

-- 2b. Позиция, которая действительно выполняется по всем точкам своего направления.
UPDATE pek_program_control_items
SET applies_to_all_points = TRUE
WHERE id = /* id позиции */ 0
  AND monitoring_point_id IS NULL;

-- ----------------------------------------------------------------------------------------------
-- Шаг 3. Проверка. Обе выборки должны быть пустыми для исправленных программ.
-- ----------------------------------------------------------------------------------------------

-- Остались ненастроенные позиции:
SELECT ci.program_id, ci.id, ci.name
FROM pek_program_control_items ci
WHERE ci.monitoring_point_id IS NULL AND ci.applies_to_all_points = FALSE;

-- Противоречивая или битая настройка: обе опции сразу, точка чужой программы или не того направления.
SELECT ci.program_id, ci.id, ci.name, ci.monitoring_point_id, ci.applies_to_all_points
FROM pek_program_control_items ci
LEFT JOIN pek_monitoring_points mp ON mp.id = ci.monitoring_point_id
WHERE ci.monitoring_point_id IS NOT NULL
  AND (ci.applies_to_all_points = TRUE
       OR mp.id IS NULL
       OR mp.program_id <> ci.program_id
       OR NOT EXISTS (SELECT 1 FROM pek_monitoring_control_items mci
                      WHERE mci.control_item_id = ci.id AND mci.monitoring_id = mp.monitoring_id));

-- ----------------------------------------------------------------------------------------------
-- Черновики протоколов, созданные при задвоении (например, №92), этот скрипт НЕ трогает.
-- Найти черновики, привязанные к позиции через точку, которая этой позиции не принадлежит:
-- ----------------------------------------------------------------------------------------------
SELECT s.protocol_id, s.program_id, s.control_item_id, s.monitoring_point_id, ci.name, ci.monitoring_point_id AS item_point_id
FROM pek_report_protocol_sources s
JOIN pek_program_control_items ci ON ci.id = s.control_item_id
WHERE ci.monitoring_point_id IS NOT NULL
  AND s.monitoring_point_id IS NOT NULL
  AND s.monitoring_point_id <> ci.monitoring_point_id;
-- Удаление или перепривязка таких черновиков - отдельное решение по каждому, через интерфейс.
