# Аудит backend настроек ПЭК

Дата: 2026-08-06.

## Состояние до изменений

`PekSettings`, `PekSettingsController`, DTO и `/api/pek/settings` отсутствовали. Frontend-блокировка соответствовала фактическому контракту backend. Отдельных company/organization/application properties для поведения collector/readiness не было.

Значения были зашиты непосредственно в код:

- collector принимал `READY`, `APPROVED`, `SIGNED` и всегда выполнял fallback по нормализованным имени и единице;
- readiness всегда блокировал missing, UNMATCHED, AMBIGUOUS, STALE и открытые превышения;
- отчёт не получал ответственного по умолчанию;
- тип отчёта всегда требовался от request;
- программа использовала только явно переданный `responsibleUserId`;
- dashboard deadline lookahead не был связан с company-настройкой.

В проекте есть общий tenant-механизм `DocumentFlowMembership` + `OrganizationResolver`, где `organization_id` ссылается на `Company`. Он валидирует client hint по активным membership и требует явного выбора при нескольких компаниях. Settings API переиспользует его и не принимает `companyId` из body/query.

Общий audit-механизм — `AuditLogService`/`audit_log`. Лаборатории являются глобальным справочником и не имеют `company_id` или access table, поэтому проверить «чужую лабораторию» на уровне текущей схемы невозможно; проверяются существование и active. Это ограничение нельзя безопасно скрыть дополнительной фиктивной связью.

OpenAPI-файл или подключённый springdoc contract в проекте до изменений не обнаружен. Добавлен отдельный проверяемый фрагмент `docs/pek-settings-openapi.yaml`.

## Реализованные изменения

- `PekSettings` и `PekSettingsRepository`, одна строка на company.
- `GET /api/pek/settings`: virtual defaults без записи в БД.
- `PUT /api/pek/settings`: first-create/update, validation, audit и optimistic locking по body `version`.
- User-specific `availableActions`; capabilities явно сообщают, что notifications и automatic collection пока не поддерживаются.
- `PekAccessService.canViewSettings/canEditSettings` и отдельные security expressions.
- Default responsible применяется при создании программы и отчёта; default report type применяется, если report request не передал period type.
- `includeOnlySignedProtocols` и `allowFallbackMatching` применяются collector.
- readiness blockers управляются пятью соответствующими настройками.
- `autoCollectProtocols=true` отклоняется структурированной validation error, поскольку надёжного event/job механизма в текущем backend нет.
