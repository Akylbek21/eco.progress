# Контрактная матрица frontend ПЭК v3

Источник: backend `eco-master (18).zip`, проверен 06.08.2026. Все JSON-ответы используют `ApiResponse<T>`.

| UI action | Backend permission | availableAction | Method | Endpoint | Request DTO / version | Response DTO | Frontend component | Test / status |
|---|---|---|---|---|---|---|---|---|
| Dashboard | `PEK_VIEW` | — | GET | `/api/pek/dashboard` | optional filters: `companyId`, `objectId`, `year`, `quarter`, `status`, `responsibleId` | `DashboardResponse` | `PekDashboardPage` | интегрирован |
| Programs | `PEK_VIEW` | — | GET | `/api/pek/programs` | server filters + pagination | `PageResponse<ProgramResponse>` | `PekProgramsPage` | интегрирован |
| Program details | `PEK_VIEW` | response list | GET | `/api/pek/programs/{id}` | — | `ProgramResponse` | `PekProgramDetailsPage` | интегрирован |
| Program history | `PEK_VIEW` | — | GET | `/api/pek/programs/{id}/history` | — | `List<ProgramHistoryEntry>` | `PekHistoryPage` | интегрирован |
| Reports | `PEK_VIEW` | — | GET | `/api/pek/reports` | required `companyId`, `objectId`; pagination | `PageResponse<ReportResponse>` | `PekReportsPage` | интегрирован |
| Report details | `PEK_VIEW` | map in response | GET | `/api/pek/reports/{id}` | — | `ReportResponse` | `PekReportWorkspacePage` | интегрирован |
| Collect | `PEK_REPORT_COLLECT` | `collect` | POST | `/api/pek/reports/{id}/collect` | backend не принимает version | `CollectionResult` | `PekReportActions` / workspace | требует согласования backend action для `LABORATORY` |
| Sources | `PEK_VIEW` | — | GET | `/api/pek/reports/{id}/sources` | optional `matchStatus`, `protocolId`, `excluded`, `manual` | `List<ReportSourceItem>` | workspace Sources | интегрирован |
| Sources summary | `PEK_VIEW` | — | GET | `/api/pek/reports/{id}/sources/summary` | — | `SourceSummary` | workspace Overview/Sources | интегрирован |
| Manual match | `PEK_REPORT_EDIT` | `matchSources` | POST | `/api/pek/reports/{id}/sources/{sourceId}/match` | `MatchSourceRequest(indicatorId, version)`; version — source version | `ReportSourceItem` | source match dialog | интегрирован |
| Exclude source | `PEK_REPORT_EDIT` | `matchSources` | POST | `/api/pek/reports/{id}/sources/{sourceId}/exclude` | `SourceMutationRequest(version, reason)` | `ReportSourceItem` | Sources | интегрирован |
| Restore source | `PEK_REPORT_EDIT` | `matchSources` | POST | `/api/pek/reports/{id}/sources/{sourceId}/restore` | `SourceMutationRequest(version, reason)` | `ReportSourceItem` | Sources | интегрирован; STALE restore скрывается |
| Plan/fact | `PEK_VIEW` | — | GET | `/api/pek/reports/{id}/plan-fact` | — | `PlanFactResponse` | workspace Plan/fact | интегрирован |
| Readiness | `PEK_VIEW` | — | GET | `/api/pek/reports/{id}/readiness` | — | `ReadinessResponse` | readiness panel / approve guard | интегрирован |
| Submit report | `PEK_REPORT_SUBMIT` | `submitReview` | POST | `/api/pek/reports/{id}/submit-review` | `If-Match` report version | `ReportResponse` | `PekReportActions` | интегрирован |
| Return report | `PEK_REPORT_RETURN` | `returnForRevision` | POST | `/api/pek/reports/{id}/return` | body `ReturnReportRequest(version, reason)` | `ReportResponse` | `PekReportActions` | интегрирован |
| Approve report | `PEK_REPORT_APPROVE` | `approve` | POST | `/api/pek/reports/{id}/approve` | `If-Match` report version | `ReportResponse` | `PekReportActions` | интегрирован; readiness pre-check |
| Archive report | `PEK_REPORT_APPROVE` | `archive` | POST | `/api/pek/reports/{id}/archive` | `If-Match` report version | `ReportResponse` | `PekReportActions` | интегрирован |
| Report history | — | — | — | endpoint отсутствует | — | — | вкладка не должна имитироваться | backend blocker |
| Read settings | `PEK_SETTINGS_VIEW` = `PEK_VIEW` | `view` | GET | `/api/pek/settings` | компания определяется активным membership backend | `PekSettingsDtos.Response` | `PekSettingsPage` | интегрирован |
| Update settings | `PEK_SETTINGS_EDIT` | `edit` | PUT | `/api/pek/settings` | `UpdateRequest`, version в body | `PekSettingsDtos.Response` | `PekSettingsPage` | интегрирован |

## Точные роли backend

- `PEK_VIEW`: `ADMIN`, `DIRECTOR`, `HEAD`, `MANAGER`, `ACCOUNTANT`, `ECOLOGIST`, `LABORATORY`, `WASTE_SPECIALIST`.
- `PEK_REPORT_CREATE`, `PEK_REPORT_EDIT`, `PEK_REPORT_COLLECT`: `ADMIN`, `DIRECTOR`, `HEAD`, `ECOLOGIST`, `LABORATORY`.
- `PEK_REPORT_SUBMIT`, `PEK_REPORT_SIGN`: `ADMIN`, `DIRECTOR`, `HEAD`, `ECOLOGIST`.
- `PEK_REPORT_RETURN`, `PEK_REPORT_APPROVE`: `ADMIN`, `DIRECTOR`, `HEAD`.
- `PEK_SETTINGS_VIEW`: все роли `PEK_VIEW`.
- `PEK_SETTINGS_EDIT`: `ADMIN`, `DIRECTOR`, `HEAD`.

## Подтверждённые расхождения backend v18

1. `PekSecurityExpressions.PEK_REPORT_COLLECT` разрешает `LABORATORY`, но `PekReportService.availableActions()` не считает `LABORATORY` автором и возвращает `collect=false`, `edit=false`, `matchSources=false`. При приоритете backend `availableActions` frontend обязан скрыть эти действия.
2. Source mutation methods не проверяют статус отчёта и не возвращают `PEK_REPORT_NOT_EDITABLE`; роль с `PEK_REPORT_EDIT` может вызвать mutation напрямую для закрытого отчёта.
3. `GET /api/pek/reports/{id}/history` отсутствует. Есть только история программы.
4. `ReportResponse` не содержит `returnInfo`, причины/автора/даты возврата, `createdAt` или `updatedAt`; `returnForRevision` не сохраняет reason в entity/audit.
5. `ReportSourceItem` v18 не содержит даты/статуса протокола, исходного значения, норматива, превышения, места отбора, даты измерения, методики или лаборатории.
6. Dashboard v18 не содержит `returnedReportCount`, `unmatchedSourceCount`, `ambiguousSourceCount`, `staleSourceCount`; несколько неподдерживаемых KPI возвращаются как обязательный `0`, поэтому frontend не может отличить «нет данных» от нулевого значения.
7. Settings company-specific, но endpoint не принимает `companyId`: компания определяется активным membership через `OrganizationResolver`.
