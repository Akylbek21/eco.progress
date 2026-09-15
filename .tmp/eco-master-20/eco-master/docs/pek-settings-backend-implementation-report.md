# Реализация backend настроек ПЭК

## Файлы и migration

Добавлены entity/repository/service/controller/DTO/enum `PekSettings*`, migration `V65__create_pek_settings.sql`, integration test `PekSettingsApiTest`. Изменены `PekAccessService`, `PekSecurityExpressions`, `PekProgramService`, `PekReportService`, `PekReportCollectionService`, `PekReportReadinessService`.

Migration создаёт `pek_settings`, unique company index, FK на company/user/laboratory и индексы responsible/laboratory. Существующие таблицы и данные не изменяются. Rollback — ручной `DROP TABLE pek_settings`.

## API и defaults

- `GET /api/pek/settings`
- `PUT /api/pek/settings`

Defaults: `QUARTERLY`, auto collect false, signed-only true, fallback true, manual ambiguous confirmation true, все readiness blockers true, deadline 7 дней, notification preferences true. GET не создаёт строку.

Версия передаётся в body последовательно с существующими settings DTO. Virtual defaults имеют version 0; первая запись создаётся с version 0, последующее обновление увеличивает её. Устаревшая version возвращает `409 PEK_SETTINGS_VERSION_CONFLICT`.

## Permissions и company scope

Все staff-роли ПЭК могут читать. `ADMIN`, `DIRECTOR`, `HEAD` могут менять. `availableActions.edit` возвращается до попытки mutation. Компания определяется `OrganizationResolver` по активному membership; request не выбирает произвольный companyId.

## Реальное применение

- Program/report: default responsible; report additionally uses default report type when request omits it.
- Collector: signed-only selection and fallback matching.
- Readiness: missing/unmatched/ambiguous/stale/open-exceedance blockers.
- Notification preferences сохраняются, но capability `notificationsSupported=false`.
- Auto collection выключен capability и не может быть включён до появления надёжного event/job.

## Проверки

```text
.\mvnw.cmd -q -DskipTests compile -> BUILD SUCCESS
.\mvnw.cmd -q -Dtest=PekSettingsApiTest test -> Tests run: 6, Failures: 0, Errors: 0
.\mvnw.cmd -q -Dtest="PekSettingsApiTest,PekFrequencyCalculatorTest,PekPlanFactExceedanceCalculationTest" test
-> Tests run: 25, Failures: 0, Errors: 0
.\mvnw.cmd -q -Dtest=PekReportCollectionReconciliationTest test
-> Tests run: 13, Failures: 2, Errors: 0 (оба теста всё ещё ожидают физическое удаление source вместо уже реализованного STALE)
```

## Ограничения

Laboratory schema глобальна и не содержит company ownership. Отдельной опубликованной OpenAPI-схемы в проекте нет. Report request пока не имеет explicit responsible field, поэтому для отчёта применяется только settings default. Notifications/automatic collection честно отключены capabilities.

Запуск: `./mvnw spring-boot:run`, `./mvnw test`, `docker compose up -d --build`.
