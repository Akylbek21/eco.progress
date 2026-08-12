# Контрактный аудит frontend ПЭК

Дата проверки: 11.08.2026.

Источник истины backend: последняя доступная в Git ревизия Java-кода перед удалением backend snapshot — commit `a78d98e`, файлы `PekController.java`, `PekApiDtos.java`, `PekReportStatus.java`, `PekSecurityExpressions.java`. В текущем `HEAD` backend-код отсутствует. README и прежние отчёты не использовались для подтверждения endpoint.

Статусы ниже означают:

- `CONNECTED` — frontend-запрос и Java controller/DTO совпадают;
- `CONTRACT_MISMATCH` — запрос существует с обеих сторон, но форма/доступ расходятся;
- `BACKEND_ENDPOINT_MISSING` — frontend нельзя честно завершить: controller method отсутствует;
- `FRONTEND_NOT_IMPLEMENTED` — backend-контракт подтверждён, но UI отсутствует;
- `BLOCKED_BY_BACKEND_SECURITY` — endpoint существует, но доступ не подтверждён для требуемого scope.

| Frontend action | Frontend method | HTTP request | Backend endpoint | Request DTO | Response DTO | Status |
|---|---|---|---|---|---|---|
| Список программ | `pekApi.getPrograms` | `GET /api/pek/programs` | `PekController.listPrograms` | query filters | `PageResponse<ProgramResponse>` | `CONNECTED` |
| Просмотр программы | `pekApi.getProgram` | `GET /api/pek/programs/{id}` | `PekController.getProgram` | — | `ProgramResponse` | `CONNECTED` |
| Создание программы | `pekApi.createProgram` | `POST /api/pek/programs` | `PekController.createProgram` | `CreateProgramRequest` | `ProgramResponse` | `CONNECTED` |
| Редактирование программы | `pekApi.updateProgram` | `PATCH /api/pek/programs/{id}` | `PekController.editProgram` | `EditProgramRequest` | `ProgramResponse` | `CONNECTED` |
| Autosave программы | `pekApi.saveProgramDraft` | `PATCH /api/pek/programs/{id}/draft` | `PekController.autosaveProgramDraft` | `EditProgramRequest` | `ProgramResponse` | `CONNECTED` |
| Workflow программы | `programAction` | `POST /api/pek/programs/{id}/{action}` | submit/return/approve/activate/archive methods | `If-Match`; reason для return | `ProgramResponse` | `CONNECTED` |
| Документы программы | upload/download methods | `POST/GET /api/pek/programs/{id}/documents...` | upload/download controller methods | multipart | `ProgramDocumentResponse` / Blob | `CONNECTED` |
| История программы | `getProgramHistory` | `GET /api/pek/programs/{id}/history` | `programHistory` | — | `List<ProgramHistoryEntry>` | `CONNECTED` |
| Список отчётов | `getReports` | `GET /api/pek/reports?companyId&objectId` | `listReports` | required query scope | `PageResponse<ReportResponse>` | `CONNECTED` |
| Контекст создания | `getReportCreationContext` | `GET /api/pek/reports/creation-context` | `creationContext` | `companyId`, `objectId`, period | `ReportCreationContext` | `CONNECTED` |
| Создание отчёта | `createReport` | `POST /api/pek/reports` | `createReport` | `CreateReportRequest` | `ReportResponse` | `CONNECTED` |
| Сбор протоколов | `collectReport` | `POST /api/pek/reports/{id}/collect` | `collect` | — | `CollectionResult` | `CONNECTED` |
| Отправка/утверждение/архив | report workflow methods | `POST .../submit-review|approve|archive` | соответствующие controller methods | `If-Match` | `ReportResponse` | `CONNECTED` |
| Возврат отчёта | `returnReport` | `POST /api/pek/reports/{id}/return` | отсутствует | `{version, reason}` | — | `BACKEND_ENDPOINT_MISSING` |
| Resource actions отчёта | `PekReportActions` | поля GET report | `ReportResponse` не содержит `availableActions`/`can*` | — | `ReportResponse` | `CONTRACT_MISMATCH` |
| Sources/reconciliation | source methods | `/reports/{id}/sources...` | отсутствуют | match/exclude/restore body | — | `BACKEND_ENDPOINT_MISSING` |
| Plan/fact | `getReportPlanFact` | `GET .../plan-fact` | отсутствует | — | — | `BACKEND_ENDPOINT_MISSING` |
| Readiness | `getReportReadiness` | `GET .../readiness` | отсутствует | — | — | `BACKEND_ENDPOINT_MISSING` |
| Lifecycle превышений | отсутствует | не создавался | отсутствует | — | — | `BACKEND_ENDPOINT_MISSING` |
| DOCX/PDF отчёта | отсутствует | не создавался | отсутствует | — | — | `BACKEND_ENDPOINT_MISSING` |
| Версии/preview документов | отсутствует | не создавался | отсутствует | — | — | `BACKEND_ENDPOINT_MISSING` |
| CMS/ЭЦП и подписи | отсутствует | не создавался | отсутствует | — | — | `BACKEND_ENDPOINT_MISSING` |
| Скачивание подписи | отсутствует | не создавался | отсутствует | — | — | `BACKEND_ENDPOINT_MISSING` |
| Настройки ПЭК | `getSettings/updateSettings` | `GET/PUT /api/pek/settings` | отсутствуют | settings body | — | `BACKEND_ENDPOINT_MISSING` |
| Memberships ПЭК | отсутствует | не создавался | отсутствует | — | — | `BACKEND_ENDPOINT_MISSING` |

Фактический backend enum отчёта: `DRAFT`, `COLLECTING`, `READY_FOR_REVIEW`, `APPROVED`, `ARCHIVED`. `SIGNED`, `RETURNED` и `IN_REVIEW` в доступном backend enum отсутствуют, поэтому их нельзя объявить подключёнными статусами.

Подтверждённая role map берётся из `PekSecurityExpressions`. Ответ `UserResponse` не содержит `permissions`; frontend использует эту строгую карту только при отсутствии явного массива permissions. Явный пустой массив означает запрет. Resource-level flags, если backend их возвращает, имеют приоритет и не расширяются ролью.
