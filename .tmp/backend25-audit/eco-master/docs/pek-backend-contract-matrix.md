# ПЭК backend contract matrix

Актуально на 2026-08-06. Реализация находится в `kz.eco.pek`; параллельный модуль не создавался.

| Область | Endpoint | DTO/сервис | Доступ и статус |
|---|---|---|---|
| Dashboard | `GET /api/pek/dashboard` | `DashboardResponse`, `PekDashboardService` | `PEK_VIEW`; company filter требует дальнейшего усиления |
| Программы | `/api/pek/programs/**` | `ProgramRequest/Response`, `PekProgramService` | DRAFT → REVIEW → APPROVED → ACTIVE → ARCHIVED |
| Отчёты | `/api/pek/reports/**` | `ReportResponse`, `PekReportService` | DRAFT, COLLECTING, READY_FOR_REVIEW, RETURNED, APPROVED, ARCHIVED |
| Сбор | `POST /reports/{id}/collect` | `CollectionResult`, `PekReportCollectionService` | только редактируемый отчёт |
| Источники | `GET /reports/{id}/sources`, summary | `ReportSourceItem`, `SourceSummary` | просмотр по PEK access expression |
| Source mutations | `POST .../match|exclude|restore` | mutation DTO с version | только DRAFT/COLLECTING/RETURNED; иначе 409 `PEK_REPORT_NOT_EDITABLE` |
| Protocol links | `POST /reports/{id}/protocol-sources`, `DELETE /api/protocols/{id}/pek-links/{linkId}` | `PekProtocolLinkService` | единый report workflow guard |
| Plan/fact | `GET /reports/{id}/plan-fact` | `PlanFactResponse`, `PekPlanFactService` | учитывает только активные MATCHED/MANUALLY_MATCHED sources |
| Readiness | `GET /reports/{id}/readiness` | `ReadinessResponse` | пересчитывается при submit и approve |
| Workflow | submit, return, approve, archive | report version | optimistic locking; return reason сохраняется |
| Settings | `GET/PUT /api/pek/settings` | `PekSettingsDtos` | сейчас всё ещё зависит от document-flow organization resolver — gap |

Роли фактического `PekSecurityExpressions`: ADMIN/DIRECTOR/HEAD выполняют review/approve; ECOLOGIST работает с программами и отчётами; LABORATORY имеет операции сбора согласно controller expressions, но матрицу `availableActions` ещё требуется полностью синхронизировать; MANAGER/ACCOUNTANT преимущественно view-only.

Основные DTO: `ProgramResponse`, `ReportResponse`, `ReportSourceItem`, `SourceSummary`, `PlanFactResponse`, `ReadinessResponse`, `DashboardResponse`. `ReportResponse` дополнен `returnInfo`.
