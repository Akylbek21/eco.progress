# Сравнение frontend ПЭК с backend из `eco-master (17).zip`

Дата проверки: 2026-09-14.

Проверены Java-контроллеры и DTO из архива против:

- `src/features/pek/api/pekService.ts`;
- `src/features/pek/api/pekContracts.ts`;
- `src/features/pek/mappers/responseMappers.ts`;
- страниц создания и рабочей области программы/отчёта.

## Результат

Основные CRUD-маршруты программ, мониторинга, реестров, отчётов, документов,
превышений, настроек и сотрудников совпадают. Найдены следующие разрывы.

## P0 — сдача отчёта не соответствует контракту

Backend `POST /api/pek/reports/{reportId}/submit` требует `SubmitReportRequest` с
реквизитами сдачи. Вызов без body отклоняется кодом
`PEK_SUBMISSION_DETAILS_REQUIRED`.

Frontend `submitReport(id, version)` использует общий `reportAction` и отправляет
пустой объект. В `PekReportWorkspacePage` сначала вызывается этот body-less
`submit`, и только затем планируется `POST /submission`. Поэтому штатная сдача
SIGNED-отчёта блокируется первым запросом.

Нужно выбрать один согласованный сценарий:

1. Передавать заполненный `SubmitReportRequest` непосредственно в `/submit` и не
   дублировать сохранение через `/submission`; либо
2. официально изменить backend-контракт перехода, если двухшаговый сценарий
   действительно является целевым.

## P1 — frontend не использует официальные данные отчёта

Backend предоставляет `GET /api/pek/reports/{id}/official-data` с:

- общими сведениями компании и объекта;
- снимком лаборатории;
- применимостью таблиц;
- официальными нормативными/фактическими таблицами;
- readiness.

В `pekService` соответствующего метода нет. Рабочая область строится из
`sources` и `plan-fact`, поэтому не может корректно показать структуру и
применимость всех официальных таблиц без клиентских догадок.

## P1 — отсутствует редактирование фактической мощности отчёта

Backend поддерживает `PATCH /api/pek/reports/{id}/general` с
`UpdateReportGeneralRequest(actualCapacity, actualCapacityUnit)`.

В frontend-сервисе нет метода для этого endpoint, а `PekReport` не объявляет
эти поля. Требуемое backend-разрешённое inline-редактирование фактической
мощности сейчас невозможно.

## P1 — ReportResponse описан не полностью

Backend возвращает поля, отсутствующие в интерфейсе `PekReport`:

- `regulationCode`;
- `actualCapacity`;
- `actualCapacityUnit`;
- `laboratorySnapshot`;
- `officialDataStatus`;
- `warnings`;
- `blockingReasons`.

Mapper начинает результат с `...source`, поэтому часть полей физически остаётся
в runtime-объекте, но TypeScript-контракт не разрешает безопасно использовать
их в UI.

## P1 — контекст создания отчёта расходится по `reportType`

Frontend `PekCreationContext` требует `reportType` и страница создания читает
его. Backend `ReportCreationContext` из архива поля `reportType` не содержит.
В runtime frontend получает `undefined`, несмотря на не-nullable TypeScript
контракт.

## P2 — возможности backend без frontend-обёртки

В `pekService` отсутствуют методы для:

- `POST /api/pek/programs/{id}/retemplate`;
- `GET /api/pek/exceedances/{id}/corrective-actions`;
- `GET /api/pek/programs/{programId}/protocols`;
- `GET /api/pek/reports/{reportId}/protocols`;
- `GET /api/pek/control-items/{controlItemId}/protocols`;
- `POST /api/pek/scheduler/run-all`.

Это не ломает существующие экраны напрямую, но делает часть реализованных
backend-возможностей недоступной из frontend.

## P2 — CorrectiveActionResponse описан частично

Frontend-модель corrective action не включает backend-поля `responsible`,
`comment`, `completedAt`, `completedBy`, `createdAt`, `updatedAt`. Они могут
приходить в ответе, но недоступны типизированному UI.

## P2 — readiness описан не полностью

Backend дополнительно возвращает готовые массивы `blockingIssues` и `warnings`.
Frontend объявляет только общий массив `issues` и повторно разделяет его на
клиенте. Текущая логика работоспособна, но контракт неполный.

## Совпадающие части

- статусы программы и отчёта совпадают;
- создание, чтение, изменение и workflow программы совпадают;
- monitoring и monitoring points совпадают;
- internal inspections, measurement QA, emergency procedures и responsibilities совпадают;
- emission/discharge/waste inventories совпадают;
- создание отчёта, collect, sources, plan-fact и readiness совпадают;
- document generation/download/signatures совпадают;
- exceedance mutations и corrective-action mutations совпадают;
- `If-Match` используется frontend для основных versioned mutations.

## Рекомендуемый порядок исправления

1. Исправить body запроса `/reports/{id}/submit`.
2. Добавить типы и API для `/official-data` и `/reports/{id}/general`.
3. Согласовать наличие `reportType` в `ReportCreationContext`.
4. Дополнить `PekReport`, readiness и corrective-action DTO.
5. Затем подключать оставшиеся backend-возможности к UI по необходимости.
