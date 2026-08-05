# Document Flow: contract matrix (iteration 2)

Проверено 03.08.2026 по исходникам `.backend-eco8/eco-master`. OpenAPI-файл в доступном backend snapshot отсутствует. Все private endpoints используют JWT `CurrentUser`; tenant либо определяется `OrganizationResolver`, либо берётся из уже tenant-bound документа. Ответы, кроме бинарных, обёрнуты в `ApiResponse<T>`.

| Frontend-функция | Backend controller | Method | URL | Request DTO | Response DTO | Authorization | organizationId | Полностью | Frontend fix | Backend fix |
|---|---|---|---|---|---|---|---|---:|---:|---:|
| Access | `DocumentFlowAccessController` | GET | `/api/document-flow/access` | — | `AccessContextDto` | JWT, membership lookup | Не принимается и не возвращается | single-org | tenant scope по user | multi-org DTO |
| Список документов | `DocumentController` | GET | `/api/document-flow/documents` | `DocumentFilter` + page/sort | `PageResponse<DocumentListItemDto>` | JWT + access | optional, resolver | частично | counters скрыты как placeholders | signer predicates/counters |
| Карточка | `DocumentController` | GET | `/api/document-flow/documents/{id}` | path + optional query | `DocumentDetailDto` | JWT + VIEW | optional, resolver | да | runtime schema | нет |
| Create | `DocumentController` | POST | `/api/document-flow/documents` | `CreateDocumentRequest` | `DocumentDetailDto` | JWT + CREATE | body optional, resolver | да | stable checkpoint key | нет |
| PATCH реквизитов | `DocumentController` | PATCH | `/api/document-flow/documents/{id}` | `UpdateDocumentRequest` | `DocumentDetailDto` | JWT + EDIT | query optional | да | PATCH + GET verification | нет |
| Delete draft | `DocumentController` | DELETE | `/api/document-flow/documents/{id}` | — | `ApiResponse<Void>` | JWT + DELETE | query optional | да | confirmation | нет |
| Main file | `DocumentController` | POST | `/api/document-flow/documents/{id}/file` | multipart file/changeReason/org | `DocumentVersion` entity | JWT + write | multipart optional | частично | response mapper/reconcile | safe response DTO |
| Versions | `DocumentController` | GET/POST | `/documents/{id}/versions[/{versionId}]` | multipart/query | `DocumentVersion` entity/list | JWT + VIEW/write | optional | частично | storage fields dropped | safe response DTO |
| Attachments | `DocumentController` | GET/POST/DELETE | `/documents/{id}/attachments[/{attachmentId}]` | multipart/query | entity/list/Void | JWT + permission | optional | частично | retry reconcile | download + safe DTO |
| Members | отсутствует | — | отсутствует | отсутствует | отсутствует | — | — | нет | blocker, без fake endpoint | controller/service/DTO |
| Counterparties | `CounterpartyController` | GET/POST/DELETE | `/api/document-flow/counterparties[/{id}]` | create record; page/size | entity/page | JWT + permission | optional, resolver | page only | локальный search удалён | server search query/name/bin |
| Representatives | `CounterpartyController` | GET/POST | `/counterparties/{id}/representatives` | create record | entity/list | JWT + permission | optional, resolver | да | client connected | safe DTO desirable |
| Route | `DocumentFlowSigningController` | GET/POST/PUT | `/documents/{id}/signing-route` | `CreateSigningRouteRequest` | `SigningRouteResponse` | JWT + VIEW/write | document-derived | частично | reconciliation + schema | validate member user/permission |
| Prepare | `DocumentFlowSigningController` | POST | `/documents/{id}/prepare-for-signing` | `PrepareForSigningRequest(expectedVersion)` | `SigningRouteResponse` | JWT + EDIT | document-derived | да | checkpoint retry | нет |
| Send | `DocumentFlowSigningController` | POST | `/documents/{id}/send-for-signing` | — | `SigningRouteResponse` | JWT + write | document-derived | да | ACTIVE reconciliation | нет |
| Internal sign | `DocumentFlowSigningController` | POST | `/documents/{id}/signatures` | `SubmitSignatureRequest` | `SignatureResponse` | JWT + own assignment | document-derived | нет end-to-end | unsafe fallback removed | action/challenge/current assignment |
| Reject/return | `DocumentFlowSigningController` | POST | `/documents/{id}/reject`, `/return-for-revision` | `RejectRequest` | Void | JWT + own assignment | document-derived | endpoint yes/action no | no unauthorized button | availableActions contract |
| Revocation | `RevocationController` | GET/POST | document/request action URLs | request records | `RevocationResponse` | JWT + permission | document-derived | endpoint yes/action no | read UI only | availableActions contract |
| Public invitation | `PublicSigningController` | GET | `/api/public/document-flow/signing/{token}` | token | `PublicInvitationView` | token, no JWT | token-derived | да | strict schema | нет |
| Public file/view/reject | `PublicSigningController` | GET/POST | `/{token}/file`, `/viewed`, `/reject` | token/RejectRequest | bytes/Void | token, no JWT | token-derived | да | shared public-safe client | нет |
| Public sign | `PublicSigningController` | POST | `/{token}/sign` | `SubmitSignatureRequest` | `SignatureResponse` | token | token-derived | нет | blocker, no fake button | invitation/challenge fields |
| Dashboard | `DocumentController` | GET | `/api/document-flow/dashboard` | optional org | `DashboardResponse` | JWT + VIEW | optional, resolver | да | tenant key | нет |
| Audit read | отсутствует | — | отсутствует | — | — | — | — | нет | blocker/no fabricated history | controller + DTO |
| Archive document | отсутствует | — | отсутствует (`ARCHIVE` action существует) | — | — | — | — | нет | no DELETE substitution | archive endpoint |

## Идентификаторы

- `SigningRouteDtos.CreateAssignmentRequest.userId` записывается в `SigningAssignment.userId`. Это именно backend user ID.
- `DocumentFlowMembership.id` — membership ID; route DTO его не принимает.
- `SigningAssignment.id` — assignment ID; он требуется в `SubmitSignatureRequest`.
- `versionId` для подписи — `DocumentDetailDto.currentVersionId`, не optimistic-lock `Document.version` и не `SigningRoute.version`.
- `DocumentFlowMemberController`, member request/response DTO и HTTP routes в проверенной версии отсутствуют. Repository не является frontend API.

## PATCH

Java `UpdateDocumentRequest` содержит только `title`, `description`, `documentNumber`, `counterpartyId`, `signingDeadline`. Метод — PATCH. `If-Match` и поле version отсутствуют. Backend сам увеличивает entity version; frontend его не увеличивает. После PATCH frontend выполняет GET и проверяет сохранённый `documentNumber`.

## Idempotency

`Idempotency-Key` читается только `POST /documents` (и отдельным admin access grant). Route, upload, prepare и send header не поддерживают. Для них frontend использует чтение фактического backend state; неподдерживаемые idempotency headers не отправляются. `clientRequestId` поддерживается submit signature, но подпись не запускается без backend action/signing context.

## Фильтры

| Filter | Frontend | Backend integration | Java evidence |
|---|---|---|---|
| direction/type/status | URL + query | работает | `DocumentSpecifications` predicates |
| counterpartyId/authorId | URL + query | работает | predicates |
| createdFrom/createdTo | URL + query | работает | inclusive day range predicates |
| deadlineFrom/deadlineTo | URL + query | работает | predicates |
| overdue | URL + boolean | работает для `true` | deadline/status predicate |
| query | debounced URL | работает | lower title/number predicate |
| signerId | API query | backend игнорирует | explicit TODO-RECONCILE |
| requiresMySignature | URL + boolean | backend игнорирует | explicit TODO-RECONCILE |
| sort/page/size | URL + query | работает через Spring Pageable | `DocumentController` |

## MSW audit

Production MSW handlers/fixtures для Document Flow отсутствуют. Единственные handlers находятся в `tests/document-flow.test.tsx`; они используют Java `ApiResponse` wrapper (`success/data/message`), `AccessContextDto`, `PageResponse` и entity-поля counterparty. Contract schemas отдельно проверяют access, list item, detail/create/update response, assignment, route, public invitation и `ApiResponse` error. Member fixture намеренно отсутствует, потому что Java DTO отсутствует.
