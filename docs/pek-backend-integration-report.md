# ПЭК: отчёт о подключении frontend к backend

Дата: 2026-07-31.

## Источник контракта

Проверен архив `C:\Users\akylbek\Downloads\eco-master (8).zip` (последний доступный архив,
31.07.2026 09:26), включая:

- `PekController`
- `PekApiDtos`
- `PekProgramStatus`
- `PekReportStatus`
- `PekPeriodType`
- `PekSecurityExpressions`
- `PekProgramService`
- `PekReportService`
- `PekReportCollectionService`

OpenAPI развернутого backend:

- `GET http://213.155.20.204:8080/v3/api-docs` → `404`
- `GET http://213.155.20.204:8080/api/v3/api-docs` → `401`

Поэтому содержимое защищённого OpenAPI без пользовательского access token получить нельзя.
Фактический контракт реализован по Java-коду архива.

## Важные расхождения Java с исходным frontend-контрактом

1. `PATCH /programs/{id}` и `PATCH /programs/{id}/draft` получают `version` в JSON body,
   а не через `If-Match`.
2. `POST /reports/{id}/collect` не получает version/`If-Match` и возвращает
   `CollectionResult { report, linkedProtocolCount, linkedProtocolNumbers }`.
3. `ProgramResponse.availableActions` — `List<String>`, не объекты action.
4. `ReportResponse` использует `reportYear`/`reportQuarter`, не содержит номера отчёта,
   вложенной программы и `linkedProtocolNumbers`.
5. `DashboardDeadline` имеет поля `id`, `type`, `date`, `description`.
6. `EditProgramRequest` не позволяет менять `companyId`, `objectId` и `number`.
7. `CloneProgramRequest` требует новый `number`; clone не использует optimistic version.
8. `ProgramResponse` не содержит `updatedAt`, хотя колонка последнего изменения требуется UI.

Эти различия отражены в централизованных response/request mapper-ах. Значения не
додумываются и не подменяются mock-данными.

## Используемые endpoint-ы

- `GET /api/pek/dashboard`
- `GET /api/pek/lookups/assignees?roles=...`
- `GET /api/pek/lookups/objects/{objectId}/permits`
- `GET /api/pek/programs`
- `GET /api/pek/programs/{id}`
- `POST /api/pek/programs`
- `PATCH /api/pek/programs/{id}`
- `PATCH /api/pek/programs/{id}/draft`
- `POST /api/pek/programs/{id}/documents`
- `GET /api/pek/programs/{id}/documents/{documentId}`
- `POST /api/pek/programs/{id}/submit-review`
- `POST /api/pek/programs/{id}/return`
- `POST /api/pek/programs/{id}/approve`
- `POST /api/pek/programs/{id}/activate`
- `POST /api/pek/programs/{id}/archive`
- `POST /api/pek/programs/{id}/clone`
- `GET /api/pek/programs/{id}/history`
- `GET /api/pek/reports`
- `GET /api/pek/reports/{id}`
- `GET /api/pek/reports/creation-context`
- `POST /api/pek/reports`
- `POST /api/pek/reports/{id}/collect`
- `POST /api/pek/reports/{id}/submit-review`
- `POST /api/pek/reports/{id}/approve`
- `POST /api/pek/reports/{id}/archive`

## Проверки

- `npm run typecheck` — успешно.
- `npm run lint` — 2/2 успешно.
- `npm test` — 155/155 Node tests и 113/113 Vitest tests успешно.
- `npx vitest run tests/pek-module.test.tsx` — 19/19 успешно.
- `node --test tests/pek-routes.test.mjs` — 4/4 успешно.
- `npm run build` — успешно, включая production-no-MSW, prerender и SEO audit.

Полный браузерный E2E против удалённого backend не запускался: OpenAPI и PEK API защищены,
а тестовые credentials/company/object/protocol fixtures не предоставлены. Frontend production
build и контрактные API/component guards проверены локально.

## Изменённые файлы

Основные:

- `package.json`
- `src/App.tsx`
- `src/main.tsx`
- `src/features/pek/api/pekApi.ts`
- `src/features/pek/api/pekApiErrors.ts`
- `src/features/pek/api/pekContracts.ts`
- `src/features/pek/api/pekQueryKeys.ts`
- `src/features/pek/api/pekService.ts`
- `src/features/pek/model/index.ts`
- `src/features/pek/mappers/programMappers.ts`
- `src/features/pek/mappers/reportMappers.ts`
- `src/features/pek/mappers/responseMappers.ts`
- `src/features/pek/forms/programDefaults.ts`
- `src/features/pek/validation/programSchema.ts`
- `src/features/pek/components/common/PekCompanyObjectFilters.tsx`
- `src/features/pek/components/common/PekLookupSelect.tsx`
- `src/features/pek/components/common/PekUi.tsx`
- `src/features/pek/components/documents/PekProgramDocuments.tsx`
- `src/features/pek/components/sections/PekHistoryTimeline.tsx`
- `src/features/pek/components/workflow/PekActionModal.tsx`
- `src/features/pek/pages/PekDashboardPage.tsx`
- `src/features/pek/pages/PekProgramsPage.tsx`
- `src/features/pek/pages/PekProgramCreatePage.tsx`
- `src/features/pek/pages/PekProgramDetailsPage.tsx`
- `src/features/pek/pages/PekHistoryPage.tsx`
- `src/features/pek/pages/PekReportsPage.tsx`
- `src/features/pek/pages/PekReportCreatePage.tsx`
- `src/features/pek/pages/PekReportWorkspacePage.tsx`
- `src/features/pek/utils/pekActions.ts`
- `src/features/pek/utils/pekErrorMapper.ts`
- `src/features/pek/utils/pekLabels.ts`
- `tests/pek-module.test.tsx`
- `tests/pek-routes.test.mjs`

Удалены production-несовместимые реализации отсутствующего backend:

- `src/features/pek/api/pekMutations.ts`
- `src/features/pek/api/pekQueries.ts`
- `src/features/pek/hooks/usePekCollection.ts`
- весь `src/features/pek/mocks/`
- report plan-fact/issues/exceedances/unmatched/review/export/sign/submission components
- `PekReportPreviewPage.tsx`
- `PekSettingsPage.tsx`
- прежние speculative response schemas/types/signature provider
- `tests/pek-msw-contract.test.ts`

## Отсутствующие backend-функции

- план/факт
- validation issues/validation engine
- превышения
- несопоставленные источники
- комментарии согласования
- возврат и редактирование отчёта
- snapshot
- подписание отчёта
- PDF/XLSX/JSON/ZIP export
- отправка во внешнюю систему
- регистрация результата рассмотрения
- создание редакции отчёта

Кнопки и вызовы этих операций из production frontend удалены.
