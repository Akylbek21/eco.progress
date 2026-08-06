# Document Flow: frontend/backend contract matrix

Дата сверки: 2026-08-05.

Источники истины в порядке приоритета:

1. Фактический ответ `GET /api/document-flow/access`, предоставленный при воспроизведении ошибки.
2. Маршруты, параметры и обязательные поля, перечисленные в актуальном техническом задании.
3. Текущий production frontend.

Актуального Java backend source в workspace нет. Попытка прочитать `/api/v3/api-docs` через настроенный backend proxy вернула `401`, поэтому неизвестные request/response DTO не считаются подтверждёнными. Старые документы `document-flow-contract-matrix-v2.md` и `document-flow-second-iteration-report.md` описывают прежний snapshot и не используются как источник актуального контракта.

| Модуль / controller | Метод | Path | Request DTO / params | Response DTO | Auth | Проверка прав | Organization | Frontend | Статус |
|---|---|---|---|---|---|---|---|---|---|
| Access | GET | `/api/document-flow/access` | `organizationId` query | Расширенный `AccessContext` | JWT | backend | обязателен после выбора | `api/documentFlowApi.ts`, `contractSchemas.ts`, `DocumentFlowGate.tsx` | Реализован; фактический ответ проверен |
| Organizations | GET | `/api/document-flow/organizations` | — | список доступных membership organizations | JWT | backend membership | возвращает допустимые tenant IDs | `useDocumentFlowTenant.ts`, `organizationSelection.ts` | Реализован; поддержаны две заявленные формы summary |
| Documents list | GET | `/api/document-flow/documents` | `organizationId` + filters/page/sort | page `DocumentListItemDto` | JWT | `VIEW_DOCUMENTS` | обязателен | `DocumentsPage.tsx`, `contractSchemas.ts` | Реализован; counters не удаляются |
| Document | GET | `/api/document-flow/documents/{id}` | `organizationId` | `DocumentDetailDto` | JWT | backend + action | обязателен | `DocumentDetailsPage.tsx` | Реализован |
| Document create | POST | `/api/document-flow/documents` | create DTO + `organizationId`, `Idempotency-Key` | document detail | JWT | `CREATE_DOCUMENT` | в body | `CreateDocumentPage.tsx`, `creationCheckpoint.ts` | Реализован без автоматического повтора create |
| Document update/delete | PATCH/DELETE | `/api/document-flow/documents/{id}` | update DTO / `organizationId` | detail / empty | JWT | backend `availableActions` | query | `DocumentDetailsPage.tsx` | Реализован |
| Main file / preview / download | POST/GET | `/documents/{id}/file`, `/preview`, `/download` | multipart или `organizationId` | version/blob | JWT | backend permissions | передаётся | `documentFlowApi.ts`, `DocumentDetailsPage.tsx` | Реализован; blob проверяется перед открытием |
| Versions | GET/POST/GET | `/documents/{id}/versions[/{versionId}/download]` | `organizationId`, multipart | list/version/blob | JWT | `UPLOAD_VERSION` / backend | передаётся | `DocumentDetailsPage.tsx` | Реализован |
| Attachments | GET/POST/DELETE/GET | `/documents/{id}/attachments[/{attachmentId}[/download]]` | `organizationId`, multipart | list/item/blob | JWT | `MANAGE_ATTACHMENTS` / backend | передаётся | `DocumentDetailsPage.tsx` | Реализован, включая download |
| Signing route | GET/POST/PUT | `/documents/{id}/signing-route` | route with `memberId` or external signer fields | signing route | JWT | `MANAGE_ROUTE` | document-derived | `SigningRouteBuilder.tsx` | Реализован; точный Java DTO внешнего подписанта требует финальной backend сверки |
| Send | POST | `/documents/{id}/send` | path document ID | backend response | JWT | action `SEND` | document-derived | `creationCheckpoint.ts`, `DocumentDetailsPage.tsx` | Реализован; старый `/send-for-signing` не используется |
| My assignment | GET | `/documents/{id}/my-assignment` | `organizationId` | assignment context | JWT | current membership | передаётся | `DocumentDetailsPage.tsx` | Реализован для отображения; точный DTO требует Java/OpenAPI |
| Internal signature | POST | `/api/document-flow/signatures` | `{documentId,versionId,assignmentId,cms,clientRequestId}` | signature | JWT | action `SIGN` + own assignment | document-derived | `documentFlowApi.ts` | Transport исправлен; UI submit заблокирован до подтверждения подписываемых bytes/challenge |
| Reject | POST | `/documents/{id}/reject` | `{reason}`, `organizationId` | backend response | JWT | action `REJECT` | query | `DocumentDetailsPage.tsx` | Реализован |
| Return for revision | POST | `/documents/{id}/return-for-revision` | `{reason}`, `organizationId` | backend response | JWT | action `RETURN_FOR_REVISION` | query | `DocumentDetailsPage.tsx` | Реализован |
| Signed package | GET | `/documents/{id}/signed-package` | `organizationId` | ZIP blob | JWT | action `DOWNLOAD_SIGNED_PACKAGE` | query | `DocumentDetailsPage.tsx` | Реализован |
| Archive | POST | `/documents/{id}/archive` | `organizationId` | backend response | JWT | action `ARCHIVE` | query | `DocumentDetailsPage.tsx` | Реализован |
| Audit | GET | `/documents/{id}/audit` | `organizationId`, page, size | page audit events | JWT | action `VIEW_AUDIT` | query | `DocumentDetailsPage.tsx` | Реализован; exact event DTO требует Java/OpenAPI |
| Members list | GET | `/api/document-flow/members` | `organizationId`, query/status/role/page/size/sort | page memberships | JWT | `MANAGE_MEMBERS` | обязателен | `MembersPage.tsx` | Реализован; response DTO mapper provisional до Java/OpenAPI |
| Members create/update/state | POST/PATCH/POST | `/members`, `/members/{id}`, `/activate`, `/deactivate` | organization + member fields | membership | JWT | `MANAGE_MEMBERS` | передаётся | `MembersPage.tsx` | UI реализован; write DTO необходимо подтвердить по Java перед production rollout |
| Counterparties list | GET | `/api/document-flow/counterparties` | `organizationId`, query/status/sort/page/size | page counterparties | JWT | backend | обязателен | `CounterpartiesPage.tsx`, `CreateDocumentPage.tsx` | Реализован server search + debounce |
| Counterparties create/update | POST/PATCH | `/counterparties`, `/counterparties/{id}` | counterparty DTO; selected organization | counterparty | JWT | `MANAGE_COUNTERPARTIES` | body/query | `CounterpartiesPage.tsx` | Реализован; update DTO требует Java/OpenAPI финальной сверки |
| Dashboard | GET | `/api/document-flow/dashboard` | `organizationId` | counters | JWT | module access | обязателен | `DashboardPage.tsx` | Реализован |
| Public signing context | GET | `/api/public/document-flow/signing/{token}` | token only | public invitation/context | public token | token validation | token-derived | `ExternalSigningPage.tsx` | Реализован, вне auth gate |
| Public challenge | GET | `/api/public/document-flow/signing/{token}/challenge` | token only | challenge | public token | token/action | token-derived | `ExternalSigningPage.tsx` | Endpoint подключён; DTO и bytes не подтверждены |
| Public sign | POST | `/api/public/document-flow/signing/{token}/sign` | `{cms,clientRequestId}`; token-only context | signature/result | public token | token/action | token-derived | `documentFlowApi.ts` | Старый payload удалён; UI submit заблокирован до проверки challenge DTO |
| Public reject | POST | `/api/public/document-flow/signing/{token}/reject` | `{reason}` | backend response | public token | token/action | token-derived | `ExternalSigningPage.tsx` | Реализован |

## Зафиксированные blockers

- Private/public challenge DTO и точные байты, над которыми backend проверяет CMS, недоступны. Подписывать SHA-256 или произвольную строку нельзя.
- DTO write-операций members и update counterparty нельзя назвать окончательно подтверждёнными без актуального Java source/OpenAPI.
- OpenAPI требует авторизацию (`401`), а действующий JWT в рабочем окружении агента отсутствует.

Эти blockers не превращаются во frontend fallback-доступ и не скрываются под статусом «готово».
