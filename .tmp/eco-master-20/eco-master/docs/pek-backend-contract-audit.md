# Аудит backend-контракта ПЭК

Дата: 2026-08-06. Область: `kz.eco.pek`, интеграция с `kz.eco.protocol`, Flyway V35/V36/V52–V64 и `src/test/java/kz/eco/pek`.

## Каноническая модель и фактические сущности

Программа представлена `PekProgram` → `PekProgramControlItem` → `PekProgramIndicator`, а также `PekProgramMeasure` и `PekProgramDocument`. Отчёт представлен `PekReport` → `PekReportProtocolSource` → `PekReportPlanFactRow` → `PekReportExceedance`. Отдельной сущности корректирующего мероприятия и документов отчёта пока нет.

`Protocol` содержит nullable legacy-поля `pekProgramId`, `pekReportId`, `pekControlItemId`, `pekControlEventId`, `monitoringPointId`, `emissionSourceId`, `waterOutletId`; они возвращаются detail DTO, но create/update/quick-create request их не принимают. `pekIndicatorId` отсутствует. Поэтому полный путь `JSON → DTO → validation → entity → DB → list/details` не реализован, а `@JsonIgnoreProperties(ignoreUnknown=true)` допускает молчаливую потерю `pekContext`.

## Существующие endpoints

- Programs: `GET/POST /api/pek/programs`, `GET/PATCH /programs/{id}`, draft autosave, documents, submit-review, return, approve, activate, archive, clone, history.
- Reports: list/get/creation-context/create, collect, plan-fact, submit-review, approve, archive.
- Sources: list; в текущей итерации добавлены summary, match, exclude, restore.
- В текущей итерации добавлены `GET /reports/{id}/readiness` и `POST /reports/{id}/return`.
- Dashboard и lookup endpoints находятся в `PekController`.
- Отдельные endpoints exceedance/corrective-action отсутствуют.

## DTO, enum и workflow

DTO собраны в `PekApiDtos` (records). Программа: `DRAFT → UNDER_REVIEW → RETURNED → APPROVED → ACTIVE → ARCHIVED`. Отчёт после изменений: `DRAFT → COLLECTING → READY_FOR_REVIEW → RETURNED → READY_FOR_REVIEW → APPROVED → ARCHIVED`. Source statuses: `MATCHED`, `UNMATCHED`, `AMBIGUOUS`, legacy `MANUAL`, `MANUALLY_MATCHED`, `EXCLUDED`, `STALE`.

До аудита `PEK_REPORT_SUBMIT` совпадал с supervisor-only review permission. Исправлено: эколог/автор может отправлять, руководитель возвращает/утверждает. `ReportResponse.availableActions` теперь рассчитывается для текущей роли и статуса. Полный tenant/company membership отсутствует в модели пользователей; `PekAccessService` проверяет согласованность company/object/program, но не membership пользователя.

## Сбор и plan/fact

Коллектор выбирает финализированные протоколы по company/object/date, создаёт whole-protocol и result-level sources, считает distinct protocol id и сохраняет UNMATCHED/AMBIGUOUS. Сопоставление пока основано на точном нормализованном имени/единице: приоритет явного `indicatorId/controlItemId/reportId/programId/normativeId` отсутствует, поскольку входной `pekContext` не реализован. Candidate ids неоднозначного результата не персистятся.

Повторный сбор сравнивает protocol version и результаты. Удалённые/выпавшие auto-source теперь получают `STALE`; изменённая версия пересобирается. Ручные и excluded записи не удаляются. Полная audit-history source mutations ещё отсутствует.

`PekPlanFactService` является расчётным источником строк и превышений. Частоты поддерживаются `PekFrequencyCalculator`; `PER_EVENT` зависит от `plannedCount`. Статусы Java отличаются от целевого wire-контракта (`PARTIALLY_COMPLETED/COMPLETED` вместо `INCOMPLETE/COMPLETE`), latestValue отсутствует.

## Validation и readiness

Период отчёта строится server-side и проверяется на покрытие программой; duplicate защищён unique period key и возвращает conflict, но код ошибки отличается от требуемого `PEK_REPORT_PERIOD_EXISTS`. Program validation находится внутри `PekProgramService`; отдельного staged `PekProgramValidationService` и структурированной модели stage/step/severity нет.

Добавленный `PekReportReadinessService` использует persisted plan/fact, sources и exceedances; блокирует missing, UNMATCHED, AMBIGUOUS, STALE, открытые превышения, отсутствие ответственного и отсутствие plan/fact. `submitForReview` пересчитывает readiness на backend. Проверки обязательных report documents, corrective actions и invalid program rows пока невозможны из-за отсутствующих сущностей.

## Dashboard и OpenAPI

Dashboard смешивает реальные метрики с фиктивными нулями и использует non-null primitive DTO. Требуется nullable metric/status contract. Полноценная OpenAPI-схема ПЭК в проекте не обнаружена; enum/ошибки/новые DTO пока документируются кодом, а не опубликованной спецификацией.

## Необходимые дальнейшие изменения

1. Ввести `PekProtocolContextRequest`, `pekIndicatorId`, строгий Jackson contract и единый validator для create/update/draft/quick-create; использовать явную связь первым при collection.
2. Персистить match candidates/reason/audit history; не удалять source identity при protocol version change.
3. Создать staged `PekProgramValidationService` и единый structured validation error response.
4. Добавить reviewer/approver timestamps/ids и workflow audit report.
5. Реализовать corrective action entity/workflow/documents и полные exceedance endpoints.
6. Ввести реальную user-company/object membership либо формализованное global staff scope.
7. Перевести dashboard на nullable/status metrics и опубликовать OpenAPI.
8. Добавить новые integration tests, включая `pekContext`, readiness, manual matching, permissions и optimistic locking.

