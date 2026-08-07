# Матрица контрактов документооборота v3

| Frontend action | Method | Backend endpoint | Request DTO | Response DTO | Status | Test |
|---|---|---|---|---|---|---|
| Список документов | GET | `/api/document-flow/documents` | query filters/page/sort | `PageResponse<DocumentListItemDto>` | FIXED | `document-flow.test.tsx` |
| Создать черновик | POST | `/api/document-flow/documents` | `CreateDocumentRequest` + `Idempotency-Key` | `DocumentDetailDto` | CONNECTED | create workflow |
| Загрузить файл | POST | `/api/document-flow/documents/{id}/file` | multipart | `DocumentVersion` | CONNECTED | create workflow |
| Создать маршрут | POST | `/api/document-flow/documents/{id}/signing-route` | `CreateSigningRouteRequest` (`userId`) | `SigningRouteResponse` | FIXED | DTO test |
| Подготовить | POST | `/api/document-flow/documents/{id}/prepare-for-signing` | `{expectedVersion}` | `SigningRouteResponse` | FIXED | workflow test |
| Отправить | POST | `/api/document-flow/documents/{id}/send-for-signing` | без body (фактический controller) | `SigningRouteResponse` | FIXED | workflow test |
| Моё назначение | GET | `/api/document-flow/documents/{id}/my-assignment` | — | `CurrentAssignmentDto`/null | FIXED | permissions test |
| Внутренняя подпись | POST | `/api/document-flow/documents/{id}/signatures` | `SubmitSignatureRequest` | `SignatureResponse` | FIXED | private-key test |
| Аудит | GET | `/api/document-flow/documents/{id}/audit` | page/size/eventType | `PageResponse<AuditEventDto>` | FIXED | schema test |
| Архивировать | POST | `/api/document-flow/documents/{id}/archive` | `{expectedVersion,reason}` | `DocumentDetailDto` | FIXED | API test |
| Signed ZIP | GET | `/api/document-flow/documents/{id}/signed-package` | — | ZIP | CONNECTED | blob test |
| Сотрудники | GET | `/api/document-flow/members` | organization context | `List<DocumentFlowMemberDto>` | FIXED | array test |
| Добавить сотрудника | POST | `/api/document-flow/members` | `{email,role}` | `DocumentFlowMemberDto` | FIXED | API test |
| Контрагенты | GET/POST/DELETE | `/api/document-flow/counterparties` | реальные controller DTO | entity/page | CONNECTED | component tests |
| Изменить контрагента | PATCH | отсутствует | — | — | BACKEND_GAP | UI action hidden |
| Внешний challenge/file/sign/reject | GET/POST | `/api/public/document-flow/signing/{token}/...` | opaque token; CMS request | challenge/signature | FIXED | token-only test |
| Admin list | GET | `/api/admin/document-flow/access` | server filters/page/sort | page access DTO | FIXED | typecheck |
| Admin detail | GET | `/api/admin/document-flow/access/{organizationId}` | — | `AdminOrganizationAccessDto` | FIXED | admin test |
| Продление | POST | `/api/admin/document-flow/subscriptions/{org}/extend` | `{newExpiresAt,reason,expectedVersion}` | access DTO | FIXED | admin test |
| Suspend/restore/revoke | POST | `/api/admin/document-flow/subscriptions/{org}/{action}` | `{reason,expectedVersion}` | access DTO | FIXED | admin test |
| Тариф | POST | `/api/admin/document-flow/subscriptions/{org}/change-plan` | `{planCode,reason,expectedVersion}` | access DTO | FIXED | typecheck |
| Лимиты | POST | `/api/admin/document-flow/subscriptions/{org}/limits` | `{limits,startsAt,expiresAt,reason,expectedVersion}` | access DTO | FIXED | typecheck |
| История подписки | GET | `/api/admin/document-flow/subscriptions/{org}/events` | page/size/filter | event page | FIXED | UI query |

Расхождения с первоначальными примерами решены в пользу фактического backend: `send-for-signing` не принимает `expectedVersion`; внутренняя подпись принимает `documentId/versionId/assignmentId`, а не `expectedVersion`.
