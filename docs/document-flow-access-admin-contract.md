# Административный контракт доступа к документообороту

Дата сверки: 2026-08-05.

## Источники контракта

В текущем workspace Java controller/DTO отсутствуют, а live OpenAPI защищён авторизацией. Поэтому маршруты сверены с уже интегрированным `adminDocumentFlowApi`, отчётом `docs/document-flow-integration-report.md` и существующими типами `PlanAdmin`, `SubscriptionAdmin`, `AccessContext`. Новые endpoint не добавлялись.

Фактическая платформенная роль административных маршрутов в проекте — `ADMIN`. Роль организации `OWNER` не используется как системная. Дополнительно UI понимает явное разрешение `DOCUMENT_FLOW_ACCESS_MANAGE`, если backend начнёт возвращать его в `user.permissions`, но существующий route tree по фактическому контракту ограничен ролью `ADMIN`.

## Матрица интеграции

| Method | Endpoint | Request DTO | Response DTO | Доступ | Frontend | Статус |
|---|---|---|---|---|---|---|
| GET | `/api/companies` | `search`, `status=ACTIVE`, `page`, `size`, `sort` | `PageResponse<CompanyListItem>` | `ADMIN` | `documentFlowAdminApi.searchOrganizations` | Интегрирован; серверный поиск по названию/БИН определяется backend `/companies` |
| GET | `/api/admin/document-flow/plans` | — | `PlanAdmin[]` | `ADMIN` | `documentFlowAdminApi.plans` | Интегрирован; форма отправляет только коды активных планов backend |
| GET | `/api/admin/document-flow/subscriptions` | — | `SubscriptionAdmin[]` | `ADMIN` | `documentFlowAdminApi.subscriptions` | Интегрирован; backend-контракт не подтверждает pagination/filter DTO |
| GET | `/api/admin/document-flow/subscriptions/{organizationId}` | path `organizationId` | `SubscriptionAdmin` | `ADMIN` | `documentFlowAdminApi.subscription` | Интегрирован |
| POST | `/api/admin/document-flow/access-grants` | `organizationId`, `planCode`, `startsAt`, nullable `expiresAt`, nullable `graceEndsAt`, `paymentMode`, nullable `paymentReference`, `reason`, optional `limits` | текущий backend-клиент описывал `AccessContext`; схема также допускает `id/subscriptionId` | `ADMIN` | `documentFlowAdminApi.createAccessGrant` | Интегрирован; `paymentMode=ADMIN_GRANT`, `Idempotency-Key`, затем обязательный GET access |
| GET | `/api/document-flow/access?organizationId={id}` | query `organizationId` | `AccessContext` | авторизованный пользователь; admin проверяет выбранную организацию | `documentFlowAdminApi.organizationAccess` | Интегрирован; это источник истины для `available/readOnly/status/reason` |
| POST | `/api/admin/document-flow/subscriptions/{organizationId}/extend` | `{ expiresAt, reason }` | существующий клиент типизирует как `AccessContext` | `ADMIN` | `documentFlowAdminApi.extend` | Интегрирован; точный Java DTO требует повторной сверки с backend source/OpenAPI |
| POST | `/api/admin/document-flow/subscriptions/{organizationId}/change-plan` | `{ planCode, reason }` | `AccessContext` | `ADMIN` | `documentFlowAdminApi.changePlan` | Интегрирован; точный Java DTO требует повторной сверки |
| POST | `/api/admin/document-flow/subscriptions/{organizationId}/limits` | `{ limits, reason }` | `AccessContext` | `ADMIN` | `documentFlowAdminApi.changeLimits` | Интегрирован; отправляются только известные `UsageMetric` |
| POST | `/api/admin/document-flow/subscriptions/{organizationId}/suspend` | `{ reason }` | `AccessContext` | `ADMIN` | `documentFlowAdminApi.suspend` | Интегрирован |
| POST | `/api/admin/document-flow/subscriptions/{organizationId}/restore` | `{ reason }` | `AccessContext` | `ADMIN` | `documentFlowAdminApi.restore` | Интегрирован |
| POST | `/api/admin/document-flow/subscriptions/{organizationId}/revoke` | `{ reason }` | `AccessContext` | `ADMIN` | `documentFlowAdminApi.revoke` | Интегрирован; физическое удаление frontend не выполняет |
| POST | `/api/admin/document-flow/subscriptions/{organizationId}/entitlements` | DTO не подтверждён | `AccessContext` | `ADMIN` | не используется | Не нужен текущей форме; нельзя интегрировать без DTO |
| POST/PATCH | `/api/admin/document-flow/plans`, `/plans/{planId}` | plan DTO | `PlanAdmin` | `ADMIN` | старый `adminDocumentFlowApi` | Вне задачи управления доступом |

## Разделённые схемы

- `accessGrantFormSchema` — проверка формы, включая обязательный срок для не-`INTERNAL` плана.
- `accessGrantRequestSchema` — allow-list API payload; допускает только `ADMIN_GRANT`, значение `MANUAL` невозможно отправить.
- `accessGrantResponseSchema` — forward-compatible ответ выдачи.
- `accessContextSchema` — фактический ответ проверки доступа.
- `subscriptionResponseSchema` и `planResponseSchema` — отдельные forward-compatible response schemas.

## Backend blockers

1. Не найден audit/history endpoint. Frontend-only история намеренно не создаётся.
2. Не подтверждены `GET/PATCH /access-grants/{id}`; операции выполняются через фактические subscription action endpoint по `organizationId`.
3. В `SubscriptionAdmin` нет подтверждённого `version`, ETag или `If-Match` контракта. UI обрабатывает `409/412` повторной загрузкой, но не отправляет выдуманный lock token.
4. `GET subscriptions` не имеет подтверждённых server filters/pagination. Организации загружаются страницами, subscription-фильтры применяются к текущей странице и это явно отмечено в UI.
5. Нет подтверждённого admin endpoint для просмотра memberships произвольной организации. Ссылка на tenant-scoped `/document-flow/members` из чужой карточки не используется.
6. Нет подтверждённого generic update DTO для `graceEndsAt` и `paymentReference`; frontend не придумывает PATCH.
7. Точные Java request DTO action-операций нужно повторно сверить после предоставления backend source или авторизованного OpenAPI.
