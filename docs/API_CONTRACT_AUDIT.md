# EcoProgress frontend/backend API contract audit

Дата сверки: 2026-08-03. Источник истины: Spring controllers, DTO, enums и exception handlers в `.backend-eco8/eco-master/src/main/java`. Backend-код не изменялся.

## Общий контракт

- Авторизованные endpoint используют `Authorization: Bearer <JWT>`; public signing и public plans JWT не требуют.
- JSON envelope: `{ data, message, success, errors, code, fieldErrors, traceId }`. Поле кода ошибки называется `code`, не `errorCode`.
- Пагинация: `{ items, page, size, totalElements, totalPages, first, last, hasNext, hasPrevious }`, `page` zero-based.
- Validation errors: HTTP 400/422 в зависимости от доменного handler, `code` и `fieldErrors`. Конфликты состояния/версии: HTTP 409 (`VERSION_CONFLICT`, `VERSION_NOT_LOCKED` и доменные коды). 401 очищает сессию; обычный 403 не является основанием для logout.
- Springdoc/OpenAPI в основном backend не подключён: `/v3/api-docs` и Swagger UI не объявлены. Поэтому генерируемый клиент нельзя достоверно подключить без изменения backend; Java DTO/controllers остаются источником контракта.

## Backend API: ПЭК

Все URL имеют префикс `/api/pek`, требуют JWT и права из `PekSecurityExpressions`.

| Method | URL | Params / headers / body | Response | Permission / status constraints |
|---|---|---|---|---|
| GET | `/dashboard` | optional `companyId,objectId,year,quarter,status,responsibleId` | `DashboardResponse` | `PEK_VIEW` |
| GET | `/lookups/assignees` | required `roles` | `AssigneeResponse[]` | `PEK_VIEW` |
| GET | `/lookups/objects/{objectId}/permits` | path `objectId` | `PermitResponse[]` | `PEK_VIEW`; backend currently has no permit entity and honestly returns empty |
| GET | `/programs` | optional `companyId,objectId,search,status,activeOn,responsibleUserId,page,size,sort` | `PageResponse<ProgramResponse>` | `PEK_VIEW`; filters are explicitly optional |
| GET | `/programs/{id}` | path `id` | `ProgramResponse` | `PEK_VIEW` |
| POST | `/programs` | `CreateProgramRequest` | `ProgramResponse` | `PEK_PROGRAM_CREATE` |
| PATCH | `/programs/{id}` | `EditProgramRequest`, including required current `version` for optimistic check | `ProgramResponse` | `PEK_PROGRAM_EDIT`; only `DRAFT,RETURNED` |
| PATCH | `/programs/{id}/draft` | partial `EditProgramRequest`, including current `version` | `ProgramResponse` | same as edit |
| POST | `/programs/{id}/documents` | multipart `file`, optional query/form `documentType` | `ProgramDocumentResponse` | `PEK_PROGRAM_EDIT` |
| GET | `/programs/{id}/documents/{documentId}` | paths | binary with `Content-Disposition` | `PEK_VIEW` |
| POST | `/programs/{id}/submit-review` | required `If-Match` | `ProgramResponse` | edit permission; `DRAFT/RETURNED -> UNDER_REVIEW` |
| POST | `/programs/{id}/return` | required `If-Match`; body `{reason}` (`version` exists in Java record but controller uses header) | `ProgramResponse` | review; `UNDER_REVIEW -> RETURNED` |
| POST | `/programs/{id}/approve` | required `If-Match` | `ProgramResponse` | approve; `UNDER_REVIEW -> APPROVED` |
| POST | `/programs/{id}/activate` | required `If-Match` | `ProgramResponse` | activate; `APPROVED -> ACTIVE` |
| POST | `/programs/{id}/archive` | required `If-Match` | `ProgramResponse` | archive; `DRAFT/ACTIVE -> ARCHIVED` |
| POST | `/programs/{id}/clone` | `CloneProgramRequest` | `ProgramResponse` | create; no version header/body |
| GET | `/programs/{id}/history` | path | `ProgramHistoryEntry[]` | view |
| GET | `/reports` | required `companyId,objectId`; optional `page,size` | `PageResponse<ReportResponse>` | view |
| GET | `/reports/{id}` | path | `ReportResponse` | view |
| GET | `/reports/creation-context` | required `companyId,objectId,periodType`; optional `year,quarter` | `ReportCreationContext` | view |
| POST | `/reports` | `CreateReportRequest {companyId,objectId,periodType,year,quarter,programId,collectImmediately}` | `ReportResponse` | report create; no responsible field |
| POST | `/reports/{id}/collect` | no body/version | `CollectionResult` | collect; `DRAFT/COLLECTING` flow |
| POST | `/reports/{id}/submit-review` | required `If-Match` | `ReportResponse` | submit |
| POST | `/reports/{id}/approve` | required `If-Match` | `ReportResponse` | approve |
| POST | `/reports/{id}/archive` | required `If-Match` | `ReportResponse` | approve permission |

Enums: program `DRAFT, UNDER_REVIEW, RETURNED, APPROVED, ACTIVE, ARCHIVED`; report `DRAFT, COLLECTING, READY_FOR_REVIEW, APPROVED, ARCHIVED`.

## Backend API: протоколы

Все `/api/protocols/**` требуют JWT и `LAB_PROTOCOL`; supervisor actions additionally require `ADMIN,DIRECTOR,HEAD`.

| Method | URL | Contract |
|---|---|---|
| GET | `/api/protocols`, `/templates`, `/{id}`, `/{id}/audit` | list query supports `search,status,templateId,subtype,companyId,objectId,laboratoryId,executorId,compliance,dateFrom,dateTo,page,size,sort,includeArchived`; list returns backend `items` page |
| POST | `/api/protocols`, `/quick-create` | create DTO / exact `QuickCreateProtocolRequest`; quick-create optionally accepts stable `Idempotency-Key` |
| PATCH / DELETE | `/api/protocols/{id}` | update carries `version` in body; physical DELETE is ADMIN-only and has no version contract |
| POST | `/{id}/ready-for-approval`, `/approve`, `/return-for-revision`, `/return-to-draft`, `/cancel`, `/archive`, `/publish-to-client`, `/corrections` | version is in the JSON body; reason field is `reason` where applicable |
| POST | `/{id}/sign` | exact body `{cmsSignatureBase64}`; only signing workflow implemented |
| GET/POST | `/{id}/preview`, `/generate-docx`, `/generate-pdf`, `/download-docx`, `/download-pdf`, `/download/docx`, `/download/pdf` | generation is POST; download/preview are authorized binary GET with `Content-Disposition` |
| POST/PATCH/DELETE | `/{id}/results`, `/{id}/results/{resultId}` | create is POST map body, update is PATCH map body, delete uses optional query `version`; no PUT collection endpoint |
| PATCH/DELETE | `/{id}/results/bulk-device`, `/bulk-place`, `/bulk` | exact bulk DTOs carry version |
| POST/DELETE | `/{id}/measurement-devices`, `/{id}/measurement-devices/{deviceId}` | attach DTO `{deviceId,version}`; detach optional query `version` |
| POST | `/{id}/check-normatives`, `/refresh-laboratory-data`, `/import-excel` | check DTO `{version}`; refresh has no body; import multipart `file` |
| GET/POST | `/method-templates`, `/{protocolId}/results/{resultId}/raw-measurements`, `.../calculate`, `/{protocolId}/calculate`, `.../calculation-history` | calculation controller contract |

Protocol status enum: `DRAFT, CALCULATED, READY, READY_FOR_APPROVAL, NEEDS_REVISION, APPROVED, SIGNED, REPLACED, CANCELLED, ARCHIVED`. Unknown values must be preserved, never mapped to `DRAFT`. Backend response contains `permissions` and the UI must consume it.

Quick-create fields are exactly: `templateId,sourceDocumentCode,docxTemplateCode,subtype,companyId,objectId,laboratoryId,executorId,protocolDate,sampleDate,measurementDate,measurementTime,measurementPlace,testingStartDate,testingEndDate,sourceNumber,conditions,measurements,printVisibility,orderId`. Signing DTO is exactly `{cmsSignatureBase64}`.

## Backend API: документооборот

| Method | URL | Contract |
|---|---|---|
| GET | `/api/document-flow/access` | no organization query; resolves membership server-side; `AccessContextDto` |
| POST | `/api/document-flow/access-requests` | access request DTO; returns 201 |
| GET | `/api/document-flow/dashboard`, `/document-types`, `/documents`, `/documents/{id}` | document list supports real `requiresMySignature` query and returns `items` page |
| POST/PATCH/DELETE | `/api/document-flow/documents`, `/documents/{id}` | create supports `Idempotency-Key`; DTOs define accepted number/date fields; detail/list include backend actions/counts |
| POST/GET | `/documents/{id}/file`, `/preview`, `/download`, `/attachments`, `/versions`, `/versions/{versionId}`, `/versions/{versionId}/download` | multipart/binary/version contracts from `DocumentController` |
| POST/GET/PUT | `/documents/{id}/signing-route` | `CreateSigningRouteRequest` / `SigningRouteResponse` |
| POST | `/documents/{id}/prepare-for-signing` | optional `{expectedVersion}`; locks current version |
| POST | `/documents/{id}/send-for-signing`, `/cancel-signing` | send requires successful prepare; cancel optional `{reason}` |
| GET/POST | `/documents/{id}/signing-data`, `/signatures`, `/signatures/verify-all`, `/verification-report` | signature body exact `{documentId,versionId,assignmentId,cms,clientRequestId}`; private key fields prohibited |
| POST | `/documents/{id}/reject`, `/return-for-revision` | `{reason}` |
| GET | `/documents/{id}/signed-package` | authorized zip/blob |
| POST/GET | `/documents/{id}/revocation-requests`, `/revocation-requests/{id}/{send|approve|reject|cancel}` | real revocation state machine |
| GET/POST | `/api/public/document-flow/signing/{token}`, `/{token}/file`, `/{token}/viewed`, `/{token}/sign`, `/{token}/reject` | public token flow; there is no public prepare endpoint |

Document statuses: `DRAFT, READY_FOR_SIGNING, SENT_FOR_SIGNING, PARTIALLY_SIGNED, SIGNED, REJECTED, RETURNED_FOR_REVISION, REVOCATION_REQUESTED, REVOKED, CANCELLED, EXPIRED, ARCHIVED`. Direction: `INCOMING, OUTGOING, INTERNAL`. Document list DTO contains real `signedCount, requiredCount, requiresMySignature, currentStep, version, availableActions`.

## Frontend → backend matrix before UI changes

| Frontend file | Method | Frontend URL | Backend endpoint | Result |
|---|---|---|---|---|
| `src/features/pek/api/pekService.ts` | GET/POST/PATCH | dashboard, programs, program workflow/history/documents | same | MATCH, except edit version placement/upload+clone extra headers |
| same | GET/POST | reports/list/detail/context/create/collect/workflow | same | MATCH, except create extra `responsibleUserId`, collect extra version header |
| same | GET | `/reports/{id}/collection-runs/latest` | none | MISSING |
| same | POST/GET | `/reports/{id}/validate`, `/issues` | none | MISSING |
| same | GET | `/reports/{id}/plan-fact` | none | MISSING |
| same | GET | `/reports/{id}/unmatched-sources` | none | MISSING |
| same | GET | `/reports/{id}/history` | none | MISSING |
| `src/services/apiProtocolService.ts` | GET/POST/PATCH/DELETE | list/detail/create/update/workflow/files/audit/bulk/calculation | same | MATCH |
| same | POST | `/protocols/{id}/prepare-signing` | none | MISSING |
| same | POST | `/protocols/{id}/sign-and-complete` | `POST /protocols/{id}/sign` | MISMATCH |
| same | PUT | `/protocols/{id}/results` | per-row POST/PATCH/DELETE | MISMATCH |
| `src/features/document-flow/api/documentFlowApi.ts` | GET | `/document-flow/access-context` | `/document-flow/access` | MISMATCH |
| same | POST | `/documents/{id}/self-sign/prepare`, `/self-sign/complete` | none | MISSING |
| same | GET | `/documents/{id}/audit` | none | MISSING |
| same | GET | `/organizations/{organizationId}/signers` | none | MISSING |
| same | POST | public `/signing/{token}/prepare` | none | MISSING |
| same | remaining document CRUD/files/versions/routes/signatures/revocations/admin | same | MATCH |
| `edo-app/src/**` | mixed | separate EDO client routes | not imported by root Vite entry or production root routing | NOT PRODUCTION; must not be edited as the active CRM implementation |

## Confirmed backend gaps

- ПЭК report readiness/issues, plan/fact, unmatched sources, report history and collection-run detail are not modeled/exposed.
- `CreateReportRequest` has no responsible/assignee field; frontend cannot persist a manually chosen report responsible.
- Protocol prepare/complete signing does not exist; only direct CMS sign exists.
- Document self-sign convenience endpoints do not exist; signing is assignment/route based.
- Document audit/history endpoint does not exist despite persistence audit service.
- Organization signer lookup endpoint does not exist. Route participants must be entered from data the backend actually accepts; no fake directory is allowed.
- Public signing prepare endpoint does not exist.

