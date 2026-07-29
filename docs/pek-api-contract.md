# PEK frontend API contract

Статус: frontend baseline, 2026-07-29. Базовый путь: `/api`.

Этот документ является единственным временным контрактом для UI и MSW до
публикации Spring Boot OpenAPI. Все строки `CONTRACT_PENDING` требуют
подтверждения backend-командой. Компоненты обращаются только по цепочке React
Query → `pekApi` → Axios; MSW перехватывает тот же HTTP-трафик.

## Envelope и страницы

Успешный JSON:

```ts
type ApiResponse<T> = { data: T; success?: boolean; message?: string | null };
type PageResponse<T> = {
  content: T[]; page: number; size: number;
  totalElements: number; totalPages: number;
};
```

Ошибка:

```ts
type ApiError = {
  status: number;
  code?: string;
  message: string;
  fieldErrors?: Array<{ field: string; message: string }>;
  issues?: PekValidationIssue[];
  correlationId?: string;
  resourceId?: number;
};
```

Для `500` backend возвращает correlation ID, но не stack trace.

## Optimistic locking

Все PATCH и command POST существующей сущности передают текущую числовую
версию в `If-Match`. Поле `version` отсутствует в body. Создание сущности не
требует `If-Match`. Несовпадение возвращает:

```http
409 Conflict
{ "code": "VERSION_CONFLICT", "message": "...", "correlationId": "..." }
```

## Programs

| Method | Path | Query/body | Response | Status |
|---|---|---|---|---|
| GET | `/pek/programs` | `search, companyId, objectId, status, responsibleId, activeOn, onlyActive, onlyExpiring, page, size, sort` | `PageResponse<PekProgramListItem>` | partially implemented |
| POST | `/pek/programs` | `PekProgramRequest` | `PekProgramDetails` | baseline |
| GET | `/pek/programs/{id}` | — | `PekProgramDetails` | baseline |
| PATCH | `/pek/programs/{id}` | `If-Match`, editable fields | `PekProgramDetails` | baseline |
| PATCH | `/pek/programs/{id}/draft` | `If-Match`, partial form | `PekProgramDetails` | CONTRACT_PENDING |
| POST | `/pek/programs/{id}/documents` | `If-Match`, multipart | document | CONTRACT_PENDING |
| POST | `/pek/programs/{id}/submit-review` | `If-Match`, comment | program | CONTRACT_PENDING |
| POST | `/pek/programs/{id}/return` | `If-Match`, required reason | program | CONTRACT_PENDING |
| POST | `/pek/programs/{id}/approve` | `If-Match` | program | CONTRACT_PENDING |
| POST | `/pek/programs/{id}/activate` | `If-Match` | program | baseline |
| POST | `/pek/programs/{id}/archive` | `If-Match`, comment | program | baseline |
| POST | `/pek/programs/{id}/clone` | `If-Match` | new program | CONTRACT_PENDING |
| GET | `/pek/programs/{id}/history` | — | `PekHistoryItem[]` | baseline |

`PekProgramDetails` содержит nullable `company`, `object`, `responsible`,
массивы `controlPoints`, `controlItems`, `indicators`, `periodicities`,
`measures`, `documents`, `availableActions`, а также `version`, `readOnly`,
`readinessPercent`.

## Reports

| Method | Path | Query/body | Response | Status |
|---|---|---|---|---|
| GET | `/pek/reports` | filters + `page,size,sort` | `PageResponse<PekReportListItem>` | baseline |
| GET | `/pek/reports/creation-context` | `companyId,objectId,periodType,year,quarter` | `PekReportCreationContext` | baseline |
| POST | `/pek/reports` | period, program, responsible, `collect` | `PekReportDetails` | baseline |
| GET | `/pek/reports/{id}` | — | `PekReportDetails` | baseline |
| PATCH | `/pek/reports/{id}` | `If-Match`, editable fields | report | CONTRACT_PENDING |
| POST | `/pek/reports/{id}/collect` | `If-Match` | `PekCollectionRun` (`202`) | baseline |
| GET | `/pek/reports/{id}/collection-runs/latest` | — | `PekCollectionRun` | baseline |
| GET | `/pek/reports/{id}/collection-runs` | pagination | runs | CONTRACT_PENDING |
| POST | `/pek/reports/{id}/validate` | `If-Match` | report/validation | baseline |
| GET | `/pek/reports/{id}/issues` | filters | `PekReportIssue[]` | baseline |
| GET | `/pek/reports/{id}/sections/{code}` | section filters | section DTO | CONTRACT_PENDING |
| GET | `/pek/reports/{id}/plan-fact` | plan/fact filters | rows | baseline |
| GET | `/pek/reports/{id}/unmatched-sources` | filters | unmatched rows | baseline |
| GET | `/pek/reports/{id}/unmatched-sources/{sourceId}/link-options` | search filters | options | CONTRACT_PENDING |
| POST | `/pek/reports/{id}/unmatched-sources/{sourceId}/link` | `If-Match`, target, reason | report | CONTRACT_PENDING |
| POST | `/pek/reports/{id}/unmatched-sources/{sourceId}/exclude` | `If-Match`, reason | report | CONTRACT_PENDING |
| GET/PATCH | `/pek/reports/{id}/exceedances[/{exceedanceId}]` | filters / `If-Match` | exceedances | CONTRACT_PENDING |
| POST | `/pek/reports/{id}/exceedances/{exceedanceId}/repeat-control` | `If-Match` | control | CONTRACT_PENDING |
| GET/POST | `/pek/reports/{id}/review-comments` | filters / `If-Match`, issue | comments | CONTRACT_PENDING |
| POST | `/pek/reports/{id}/review-comments/{commentId}/resolve` | `If-Match`, resolution | comment | CONTRACT_PENDING |
| POST | `/pek/reports/{id}/{submit-review,start-review,return,accept-review,approve,recall-approval}` | `If-Match`, command payload | report | CONTRACT_PENDING |
| POST | `/pek/reports/{id}/prepare-signing` | `If-Match` | signing payload | CONTRACT_PENDING |
| POST | `/pek/reports/{id}/sign` | `If-Match`, CMS | report/signature | CONTRACT_PENDING |
| POST | `/pek/reports/{id}/submission` | `If-Match`, multipart metadata | report/submission | CONTRACT_PENDING |
| POST | `/pek/reports/{id}/result` | `If-Match`, result metadata | report | CONTRACT_PENDING |
| POST | `/pek/reports/{id}/revision` | `If-Match`, required reason and copy options | new report | CONTRACT_PENDING |
| POST | `/pek/reports/{id}/archive` | `If-Match`, comment | report | CONTRACT_PENDING |
| GET | `/pek/reports/{id}/history` | pagination | history | baseline |

Exports are separate GET operations:

- `/pek/reports/{id}/exports/preview.pdf`
- `/pek/reports/{id}/exports/report.pdf`
- `/pek/reports/{id}/exports/report.xlsx`
- `/pek/reports/{id}/exports/report.json`
- `/pek/reports/{id}/exports/archive.zip`

Все export paths — `CONTRACT_PENDING`. Preview возвращает реальные bytes
документа. Development MSW возвращает Blob и UI должен обозначать mock mode.

## Directory, dashboard, settings

- `GET /pek/dashboard` — dashboard counters/deadlines/actions.
- `GET /pek/lookups/assignees?roles=...` — сотрудники.
- `GET /pek/lookups/objects/{objectId}/permits` — разрешения.
- `GET/PATCH /pek/settings` — admin settings, PATCH с `If-Match`.

Справочники контрольных точек, показателей, нормативов, лабораторий и поиск
протоколов — `CONTRACT_PENDING`; новые paths до согласования не добавляются.

## Enums

Program status:
`DRAFT | UNDER_REVIEW | RETURNED | APPROVED | ACTIVE | ARCHIVED`.

Report status:
`DRAFT | COLLECTING | REQUIRES_CORRECTION | READY_FOR_REVIEW |
UNDER_REVIEW | RETURNED | READY_FOR_APPROVAL | APPROVED |
READY_FOR_SIGNING | PARTIALLY_SIGNED | SIGNED | SUBMITTED | ACCEPTED |
REJECTED | ARCHIVED`.

Collection:
`CREATED | RUNNING | COMPLETED | COMPLETED_WITH_WARNINGS | FAILED |
CANCELLED`. `PENDING/SUCCESS/PARTIAL_SUCCESS` временно принимаются для
совместимости и должны быть удалены после OpenAPI migration.

## Permissions

`PEK_VIEW`, `PEK_PROGRAM_CREATE`, `PEK_PROGRAM_EDIT`,
`PEK_PROGRAM_ACTIVATE`, `PEK_PROGRAM_ARCHIVE`, `PEK_REPORT_CREATE`,
`PEK_REPORT_EDIT`, `PEK_REPORT_COLLECT`, `PEK_REPORT_VALIDATE`,
`PEK_REPORT_REVIEW`, `PEK_REPORT_RETURN`, `PEK_REPORT_APPROVE`,
`PEK_REPORT_SIGN`, `PEK_REPORT_SUBMIT`, `PEK_REPORT_EXPORT`, `PEK_ADMIN`.

Backend возвращает permissions пользователя и `availableActions` сущности.
Frontend не выводит action из одного status и не является security boundary.

Available action codes:
`EDIT, COLLECT, VALIDATE, SUBMIT_REVIEW, START_REVIEW, RETURN,
ACCEPT_REVIEW, APPROVE, RECALL_APPROVAL, PREPARE_SIGNING, SIGN,
REGISTER_SUBMISSION, REGISTER_RESULT, CREATE_REVISION, ARCHIVE, CLONE,
ACTIVATE, DOWNLOAD_PREVIEW, DOWNLOAD_PDF, DOWNLOAD_XLSX, DOWNLOAD_JSON,
DOWNLOAD_ZIP, CREATE_PROTOCOL, OPEN_PROTOCOL, ADD_REVIEW_COMMENT,
RESOLVE_REVIEW_COMMENT`.

## Error codes

- `400`: malformed request and field errors.
- `401`: refresh once, then authentication required. Refresh path/DTO —
  `CONTRACT_PENDING`; frontend не изобретает endpoint.
- `403 PEK_FORBIDDEN`.
- `404 PEK_PROGRAM_NOT_FOUND | PEK_REPORT_NOT_FOUND`.
- `409 VERSION_CONFLICT | PEK_REPORT_ALREADY_EXISTS |
  PEK_PROGRAM_OVERLAP`.
- `422 PEK_VALIDATION_FAILED` with structured issues.
- `500 PEK_INTERNAL_ERROR` with correlation ID.
