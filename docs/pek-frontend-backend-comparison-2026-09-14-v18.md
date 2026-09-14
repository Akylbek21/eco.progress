# Повторное сравнение frontend ПЭК с `eco-master (18).zip`

Дата проверки: 2026-09-14.

Архив использован только как источник backend-кода. Комментарии и документы внутри архива не рассматривались как инструкции к изменению проекта.

## Статус после исправления frontend

Выявленные frontend-разрывы исправлены: обновлены контракты мощности, сдача отчёта, official-data/general API, категории, внутренние проверки, readiness DTO, корректирующие действия, protocol/retemplate/scheduler API. Единственное оставшееся расхождение находится на стороне backend: `ReportCreationContext` не возвращает `reportType`; frontend теперь безопасно нормализует отсутствующее значение в `null`.

## Краткий результат

Основные маршруты программ ПЭК, мониторинга, отчётов, документов, превышений, настроек и сотрудников совпадают. Однако frontend пока не приведён к новому контракту backend №18. Есть два критичных разрыва и несколько неполных интеграций.

По сравнению с `eco-master (17).zip` backend ПЭК изменён в 9 Java-файлах: 204 добавления и 35 удалений. Главные изменения касаются реквизитов мощности, серверной готовности программы и внутренних проверок.

## P0 — форма программы использует устаревший контракт мощности

Backend №18 удалил `actualCapacity` из `FacilitySnapshotDto` и из сущности программы. Фактическая мощность теперь относится только к конкретному отчётному периоду и хранится в `PekReport`.

Одновременно backend добавил в снимок программы отдельное поле `designCapacityUnit` и блокирует готовность, если отсутствует значение проектной мощности или её единица измерения.

Frontend всё ещё:

- объявляет и отправляет `facilitySnapshot.actualCapacity`;
- показывает обязательное поле «Фактическая мощность» при создании программы;
- не объявляет и не отправляет `designCapacityUnit`;
- предлагает вводить значение и единицу проектной мощности одной строкой в `designCapacity`.

Следствие: введённая пользователем фактическая мощность программы будет проигнорирована backend с успешным HTTP-ответом, а `designCapacityUnit` останется пустым. Серверная readiness-проверка вернёт `DESIGN_CAPACITY_REQUIRED`, поэтому программу нельзя будет довести до готовности.

Нужно удалить `actualCapacity` из формы/DTO программы, добавить отдельные `designCapacity` и `designCapacityUnit`, а фактическую мощность редактировать на странице отчёта через `PATCH /api/pek/reports/{id}/general`.

## P0 — сдача отчёта по-прежнему отправляется без обязательных реквизитов

Backend `POST /api/pek/reports/{reportId}/submit` требует `SubmitReportRequest`:

- `submittedAt`;
- `submissionMethod`;
- `registrationNumber` для `ECO_PORTAL`/`EGOV_PORTAL`;
- `confirmationFileId` при наличии файла;
- `comment` для способа `OTHER`.

Вызов без body отклоняется кодом `PEK_SUBMISSION_DETAILS_REQUIRED`.

Frontend `submitReport(id, version)` по-прежнему вызывает общий `reportAction` с пустым объектом. В `PekReportWorkspacePage` этот вызов выполняется раньше `recordReportSubmission`, поэтому штатная сдача подписанного отчёта останавливается на первом запросе.

Нужно отправлять заполненный `SubmitReportRequest` непосредственно в `/submit` и убрать дублирующий двухшаговый сценарий либо согласованно изменить backend-контракт.

## P1 — официальный отчёт интегрирован не полностью

Во frontend отсутствуют методы и полноценные типы для:

- `GET /api/pek/reports/{id}/official-data`;
- `PATCH /api/pek/reports/{id}/general`.

Интерфейс `PekReport` не описывает возвращаемые backend-поля:

- `regulationCode`;
- `actualCapacity`;
- `actualCapacityUnit`;
- `laboratorySnapshot`;
- `officialDataStatus`;
- `warnings`;
- `blockingReasons`.

Из-за этого UI не может типобезопасно показать официальные таблицы, применимость разделов, снимок лаборатории и редактирование фактической мощности отчётного периода.

## P1 — `reportType` отсутствует в контексте создания отчёта

Frontend требует `PekCreationContext.reportType` и использует его для выбора подписи годового отчёта.

Backend `ReportCreationContext` №18 по-прежнему не содержит `reportType`, несмотря на комментарий о совпадении формы ответа с frontend. В runtime frontend получает `undefined` вместо заявленного `PekReportType | null`.

Нужно либо добавить вычисленный `reportType` в backend-контекст, либо убрать зависимость страницы создания от этого поля и получать тип из другого официального серверного поля.

## P1 — frontend предлагает неподдерживаемые категории

Backend №18 разрешает создать/изменить программу только для категорий I и II; III и IV возвращают `PEK_CATEGORY_NOT_SUPPORTED`.

Frontend в форме программы предлагает варианты I, II, III и IV. Нужно оставить I/II либо заранее показывать понятное ограничение, согласованное с backend.

## P1 — расширенные внутренние проверки не поддержаны frontend

Backend добавил к внутренней проверке поля:

- `department`;
- `frequencyType`;
- `violations`;
- `correctiveActions`.

Они отсутствуют в `PekInternalInspection`, запросах и форме `PekProgramStructuredSections`. Данные нельзя ввести или отобразить из UI.

## P2 — новый итог готовности программы типизирован не полностью

Backend `ProgramResponse` теперь напрямую возвращает:

- `ready`;
- `blockingReasons`;
- `warnings`.

В `PekProgram` этих полей нет. Благодаря `...source` они могут физически сохраниться в runtime-объекте, но недоступны типобезопасному UI. Отдельный `/programs/{id}/readiness` продолжает работать, поэтому это не блокирует текущую страницу деталей.

Кроме того, `PekReadinessResponse` frontend всё ещё не описывает готовые массивы backend `blockingIssues` и `warnings`, а повторно делит общий `issues` на клиенте.

## P2 — backend-возможности без frontend-обёртки

В `pekService` по-прежнему отсутствуют методы для:

- `POST /api/pek/programs/{id}/retemplate`;
- `GET /api/pek/exceedances/{id}/corrective-actions`;
- `GET /api/pek/programs/{programId}/protocols`;
- `GET /api/pek/reports/{reportId}/protocols`;
- `GET /api/pek/control-items/{controlItemId}/protocols`;
- `POST /api/pek/scheduler/run-all`.

Frontend-модель corrective action также не содержит всех полей backend: `responsible`, `comment`, `completedAt`, `completedBy`, `createdAt`, `updatedAt`.

## Что совпадает

- базовые CRUD и workflow программ;
- контрольные позиции, показатели и мероприятия;
- направления мониторинга и точки мониторинга;
- основные структурированные разделы программы;
- реестры выбросов, сбросов и отходов;
- создание отчёта, сбор, sources, plan-fact и readiness;
- генерация, загрузка и подписание документов;
- операции с превышениями и изменения корректирующих действий;
- versioned mutations с заголовком `If-Match`.

## Рекомендуемый порядок исправления frontend

1. Перенести фактическую мощность с программы в отчёт и добавить `designCapacityUnit` в программу.
2. Исправить body запроса `/reports/{id}/submit`.
3. Подключить `/official-data` и `/reports/{id}/general`, дополнить `PekReport`.
4. Согласовать `reportType` в creation context.
5. Ограничить категории I/II и добавить новые поля внутренних проверок.
6. Дополнить DTO готовности и оставшиеся API-обёртки.
