# Контрактная матрица frontend ПЭК

Источник истины: контроллеры и DTO backend из `eco-master (17).zip`, проверены 06.08.2026. Базовый URL основного контроллера — `/api/pek`, настроек — `/api/pek/settings`. Все JSON-ответы, кроме скачивания файла, обёрнуты в `ApiResponse<T>`.

| Frontend action | HTTP method | Endpoint | Request DTO / version | Response DTO | Backend permission | Status | Implemented component |
|---|---|---|---|---|---|---|---|
| Dashboard | GET | `/api/pek/dashboard` | query: `companyId`, `objectId`, `year`, `quarter`, `status`, `responsibleId` | `DashboardResponse` | `PEK_VIEW` | Проверен | `PekDashboardPage` |
| Список исполнителей | GET | `/api/pek/lookups/assignees` | query: `roles` | `List<AssigneeResponse>` | `PEK_VIEW` | Проверен | формы ПЭК |
| Разрешения объекта | GET | `/api/pek/lookups/objects/{objectId}/permits` | — | `List<PermitResponse>` | `PEK_VIEW` | Backend возвращает пустой список: сущность разрешений отсутствует | формы ПЭК |
| Список программ | GET | `/api/pek/programs` | фильтры + `page`, `size`, `sort` | `PageResponse<ProgramResponse>` | `PEK_VIEW` | Проверен | `PekProgramsPage` |
| Программа | GET | `/api/pek/programs/{id}` | — | `ProgramResponse` | `PEK_VIEW` | Проверен | `PekProgramDetailsPage` |
| Создать программу | POST | `/api/pek/programs` | `CreateProgramRequest` | `ProgramResponse` | `PEK_PROGRAM_CREATE` | Проверен | `PekProgramCreatePage` |
| Изменить программу | PATCH | `/api/pek/programs/{id}` | `EditProgramRequest`, `version` в body | `ProgramResponse` | `PEK_PROGRAM_EDIT` | Проверен | `PekProgramCreatePage` |
| Сохранить черновик | PATCH | `/api/pek/programs/{id}/draft` | частичный `EditProgramRequest`, `version` в body | `ProgramResponse` | `PEK_PROGRAM_EDIT` | Проверен | `PekProgramCreatePage` |
| Отправить программу | POST | `/api/pek/programs/{id}/submit-review` | `If-Match` | `ProgramResponse` | `PEK_PROGRAM_EDIT` | Проверен | `PekProgramDetailsPage` |
| Вернуть программу | POST | `/api/pek/programs/{id}/return` | `If-Match`; body `{ reason }` | `ProgramResponse` | `PEK_PROGRAM_REVIEW` | Проверен | `PekProgramDetailsPage` |
| Утвердить программу | POST | `/api/pek/programs/{id}/approve` | `If-Match` | `ProgramResponse` | `PEK_PROGRAM_APPROVE` | Проверен | `PekProgramDetailsPage` |
| Активировать программу | POST | `/api/pek/programs/{id}/activate` | `If-Match` | `ProgramResponse` | `PEK_PROGRAM_ACTIVATE` | Проверен | `PekProgramDetailsPage` |
| Архивировать программу | POST | `/api/pek/programs/{id}/archive` | `If-Match` | `ProgramResponse` | `PEK_PROGRAM_ARCHIVE` | Проверен | `PekProgramDetailsPage` |
| Клонировать программу | POST | `/api/pek/programs/{id}/clone` | `CloneProgramRequest` | `ProgramResponse` | `PEK_PROGRAM_CREATE` | Проверен | `PekProgramDetailsPage` |
| История программы | GET | `/api/pek/programs/{id}/history` | — | `List<ProgramHistoryEntry>` | `PEK_VIEW` | Проверен | `PekHistoryPage` |
| Загрузить документ программы | POST multipart | `/api/pek/programs/{id}/documents` | `file`, optional `documentType` | `ProgramDocumentResponse` | `PEK_PROGRAM_EDIT` | Проверен | `PekProgramDetailsPage` |
| Скачать документ программы | GET | `/api/pek/programs/{id}/documents/{documentId}` | — | binary | `PEK_VIEW` | Проверен | `PekProgramDetailsPage` |
| Список отчётов | GET | `/api/pek/reports` | обязательные `companyId`, `objectId`; `page`, `size` | `PageResponse<ReportResponse>` | `PEK_VIEW` | Проверен | `PekReportsPage` |
| Контекст создания отчёта | GET | `/api/pek/reports/creation-context` | `companyId`, `objectId`, `periodType`, optional `year`, `quarter` | `ReportCreationContext` | `PEK_VIEW` | Проверен | `PekReportCreatePage` |
| Создать отчёт | POST | `/api/pek/reports` | `CreateReportRequest` | `ReportResponse` | `PEK_REPORT_CREATE` | Проверен | `PekReportCreatePage` |
| Отчёт | GET | `/api/pek/reports/{id}` | — | `ReportResponse` | `PEK_VIEW` | Проверен | `PekReportWorkspacePage` |
| Собрать данные | POST | `/api/pek/reports/{id}/collect` | — | `CollectionResult` | `PEK_REPORT_COLLECT` | Интегрирован, counts/warnings сохранены | `PekReportWorkspacePage` |
| План/факт | GET | `/api/pek/reports/{id}/plan-fact` | — | `PlanFactResponse` | `PEK_VIEW` | Интегрирован | `PekReportWorkspacePage` |
| Источники | GET | `/api/pek/reports/{id}/sources` | optional `matchStatus`, `protocolId`, `excluded`, `manual` | `List<ReportSourceItem>` | `PEK_VIEW` | Интегрирован | `PekReportWorkspacePage` |
| Сводка источников | GET | `/api/pek/reports/{id}/sources/summary` | — | `SourceSummary` | `PEK_VIEW` | Интегрирован | `PekReportWorkspacePage` |
| Ручное сопоставление | POST | `/api/pek/reports/{id}/sources/{sourceId}/match` | `{ indicatorId, version }` | `ReportSourceItem` | `PEK_REPORT_EDIT` | Интегрирован | `PekReportWorkspacePage` |
| Исключить источник | POST | `/api/pek/reports/{id}/sources/{sourceId}/exclude` | `{ version, reason }` | `ReportSourceItem` | `PEK_REPORT_EDIT` | Интегрирован | `PekReportWorkspacePage` |
| Восстановить источник | POST | `/api/pek/reports/{id}/sources/{sourceId}/restore` | `{ version, reason }` | `ReportSourceItem` | `PEK_REPORT_EDIT` | Интегрирован | `PekReportWorkspacePage` |
| Готовность | GET | `/api/pek/reports/{id}/readiness` | — | `ReadinessResponse` | `PEK_VIEW` | Интегрирован | `PekReportWorkspacePage` |
| Отправить отчёт | POST | `/api/pek/reports/{id}/submit-review` | `If-Match` | `ReportResponse` | `PEK_REPORT_SUBMIT` | Интегрирован с readiness | `PekReportWorkspacePage` |
| Вернуть отчёт | POST | `/api/pek/reports/{id}/return` | body `{ version, reason }`, без `If-Match` | `ReportResponse` | `PEK_REPORT_RETURN` | Интегрирован, MUI Dialog | `PekReportWorkspacePage` |
| Утвердить отчёт | POST | `/api/pek/reports/{id}/approve` | `If-Match` | `ReportResponse` | `PEK_REPORT_APPROVE` | Интегрирован | `PekReportWorkspacePage` |
| Архивировать отчёт | POST | `/api/pek/reports/{id}/archive` | `If-Match` | `ReportResponse` | `PEK_REPORT_APPROVE` | Интегрирован | `PekReportWorkspacePage` |
| Получить настройки | GET | `/api/pek/settings` | — | `PekSettingsDtos.Response` | `PEK_SETTINGS_VIEW` | Интегрирован | `PekSettingsPage` |
| Сохранить настройки | PUT | `/api/pek/settings` | `PekSettingsDtos.UpdateRequest`, `version` в body | `PekSettingsDtos.Response` | `PEK_SETTINGS_EDIT` | Интегрирован | `PekSettingsPage` |

## Подтверждённая модель доступа

В актуальном `UserResponse` массива `permissions` нет. Backend применяет `@PreAuthorize` с реальными ролями:

- просмотр: `ADMIN`, `DIRECTOR`, `HEAD`, `MANAGER`, `ACCOUNTANT`, `ECOLOGIST`, `LABORATORY`, `WASTE_SPECIALIST`;
- создание/редактирование программ: `ADMIN`, `DIRECTOR`, `HEAD`, `ECOLOGIST`;
- создание/сбор отчётов: `ADMIN`, `DIRECTOR`, `HEAD`, `ECOLOGIST`, `LABORATORY`;
- review/approve/activate/archive: `ADMIN`, `DIRECTOR`, `HEAD`;
- настройки: просмотр — роли просмотра; изменение — `ADMIN`, `DIRECTOR`, `HEAD`.

Если auth DTO в будущей версии вернёт явный массив permissions, frontend использует его. Если массив явно получен пустым, доступ не предоставляется. Ролевая матрица применяется только для текущего подтверждённого DTO, где поле отсутствует.

## Optimistic locking

- `PATCH program` и `PATCH program/draft`: `version` в body.
- Program workflow и report submit/approve/archive: `If-Match`.
- Report return, source match/exclude/restore, settings update: `version` в body.
- `collect` не принимает версию.
