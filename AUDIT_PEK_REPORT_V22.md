# Повторная проверка ПЭК / отчёта ПЭК

Дата: 2026-09-16  
Проверяемый архив: `eco-master (22).zip`  
База сравнения: `eco-master (21).zip` и `AUDIT_PEK_PROGRAM_REPORT_PROTOCOLS.md`

## Итог

Версия 22 **не готова к production-приёмке**. Исправления, связанные с формированием требований ПЭК по точкам мониторинга и длиной `regulation_version`, выглядят логично на уровне кода, но четыре ранее отмеченных риска остались, а обязательный воспроизводимый прогон тестов по-прежнему невозможен через поставленный Windows Maven Wrapper.

## Статус прежних замечаний

| Приоритет | Замечание | Статус в v22 | Подтверждение |
|---|---|---|---|
| P0 | Production создаёт demo ADMIN с известным паролем | **Не исправлено** | `DataSeeder` всё ещё без `@Profile`, создаёт `admin@ecoprogress.kz / admin123`: `src/main/java/kz/eco/config/DataSeeder.java:40`, `:151` |
| P1 | `mvnw.cmd` падает на Windows | **Не исправлено** | `mvnw.cmd:92` всё ещё индексирует `(Get-Item $MAVEN_M2_PATH).Target[0]`; фактический запуск завершился `Cannot index into a null array` и `Cannot start maven from wrapper` |
| P1 | ADMIN JWT хранится в `localStorage` | **Не исправлено** | `src/main/resources/static/pek-admin/index.html:164`, `:206`, `:214` |
| P2 | Flyway и Hibernate одновременно меняют production-схему | **Не исправлено** | `src/main/resources/application-docker.properties:9`: `spring.jpa.hibernate.ddl-auto=update` |
| P2 | Mutation DTO молча принимают неизвестные поля | **Частично исправлено ранее, но системно не закрыто** | В критичных DTO ещё встречается `@JsonIgnoreProperties(ignoreUnknown = true)`, в том числе `LaboratoryDtos` и `LabJournalDtos`; в этой версии `ProtocolApiDtos` не менялся |
| P3 | Security fallback разрешает все маршруты вне перечисленных правил | **Не исправлено** | `src/main/java/kz/eco/config/SecurityConfig.java:122`: `.anyRequest().permitAll()` |

## Что изменено в v22 по ПЭК

1. В `PekProgramControlItem` добавлен явный флаг `appliesToAllPoints`.
2. API запрещает одновременно передавать конкретную `monitoringPointId` и `appliesToAllPoints=true`.
3. Позиция без точки и без явного флага больше не размножается по всем точкам: она возвращается как одно требование `CONFIGURATION_REQUIRED`.
4. При копировании программы новый флаг переносится в копию.
5. Добавлена миграция `V128__pek_control_item_applies_to_all_points.sql` с обратной совместимостью для существующих строк.
6. Добавлена миграция `V127__pek_regulation_version_column_width_fix.sql`, расширяющая `regulation_version` до `VARCHAR(500)` для MySQL.

Логика исправления задвоения требований выглядит корректной, но для неё **не добавлены целевые регрессионные тесты**. Из тестов изменён только конструктор DTO в `PekProgramValidationTest`; нет проверок сценариев:

- две позиции + две точки не дают четыре требования;
- `appliesToAllPoints=true` действительно создаёт требование для каждой точки;
- пустые `monitoringPointId` и `appliesToAllPoints` дают ровно одно `CONFIGURATION_REQUIRED`;
- одновременная передача флага и ID точки возвращает 400;
- флаг сохраняется после копирования программы;
- миграции V127/V128 проходят на чистой и обновляемой MySQL-схеме.

## Дополнительный риск в логике точек

Если `monitoringPointId` заполнен, но не относится к текущему блоку мониторинга, `pointsFor(...)` возвращает пустой список с `unconfigured=false`. Далее создаётся требование без точки, которое может не получить `CONFIGURATION_REQUIRED`. Нужна серверная проверка принадлежности точки программе/направлению при сохранении и отдельный тест на чужой или несуществующий ID точки.

Файлы: `src/main/java/kz/eco/protocol/ProtocolPekCreationService.java:192-201`, `:503-510`; `src/main/java/kz/eco/pek/PekProgramService.java:825-835`.

## Результат запуска

- `mvnw.cmd -q -DskipTests compile` — **FAIL до старта Maven**: `Cannot index into a null array`.
- Прямой запуск найденного Maven — **не выполнен**, потому что в среде отсутствует корректный `JAVA_HOME`/Java 21.
- Готовых `target/surefire-reports` в архиве нет.

Поэтому компиляция и тесты этой поставки не подтверждены.

## Сопоставление с ошибкой production

На `https://ecoprogress.kz` зафиксированы:

- `GET /api/pek/reports/1/package` → 404;
- `POST /api/pek/reports/1/package/generate` → 500;
- `POST /api/pek/reports/1/document/generate-official-pdf` → 500;
- `POST /api/pek/reports/1/document/generate-internal-pdf` → 500.

Первый 404 является ожидаемым до создания первого комплекта: `PekReportPackageService.latest(...)` не находит ещё не сформированную версию. Это прямо учтено в backend-комментариях: `GET .../package 404s until the first one exists`.

Общая причина трёх POST 500 с высокой уверенностью — несовпадение размера колонки MySQL. Все три операции в конце создают запись версии документа с нормативной ссылкой. Приложение ожидает `VARCHAR(500)`, но прежняя миграция V117 использовала H2-синтаксис и не расширила production-колонки MySQL, оставив `VARCHAR(120)`. Текущая нормативная ссылка имеет около 272 символов, поэтому вставка завершается `Data truncation` и вся транзакция откатывается.

Версия 22 уже содержит предназначенное для этой ошибки исправление — `V127__pek_regulation_version_column_width_fix.sql`. Значит, наблюдаемый production-результат указывает на одно из двух:

1. backend v22 ещё не развёрнут;
2. v22 развёрнут, но Flyway V127 не выполнился/не попал в БД.

Проверка на сервере:

```sql
SELECT version, description, success
FROM flyway_schema_history
WHERE version IN ('127', '128');

SELECT table_name, column_name, column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN ('pek_programs', 'pek_reports', 'pek_report_document_versions')
  AND column_name = 'regulation_version';
```

Ожидается успешная V127 и `varchar(500)` во всех трёх таблицах. После применения миграции нужно перезапустить backend и повторить сначала генерацию официального/внутреннего документа, затем комплекта ПЭК.

## Решение о готовности

Статус: **не готово к production**.

Минимум для повторной приёмки:

1. Закрыть P0 с production demo-аккаунтами.
2. Исправить `mvnw.cmd` и предоставить зелёный полный прогон тестов на Java 21.
3. Добавить перечисленные регрессионные тесты ПЭК и прогнать миграции на MySQL 8.
4. Перевести production на `ddl-auto=validate`.
5. Убрать ADMIN JWT из `localStorage` и применить deny-by-default для маршрутов.
