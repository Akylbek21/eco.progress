# Отчёт об исправлении frontend документооборота

## Реализовано

- Production source of truth закреплён за `src/features/document-flow`; `edo-app` не импортируется root build/routes.
- Единый API boundary требует envelope с `success: true`; `success: false` и contract mismatch не превращаются в успешные данные.
- Zod-схемы документов приведены к `DocumentListItemDto`/`DocumentDetailDto`, удалён `.passthrough()`.
- Исправлены `prepare-for-signing`, `send-for-signing`, внутренний `/documents/{id}/signatures`, opaque public signing endpoints.
- Маршрут использует backend `userId`; `memberId` удалён из production contract.
- Create workflow получил явные состояния, checkpoint/reconciliation и проверку статуса после отправки.
- Внутреннее и внешнее подписание вызывают NCALayer только по явному нажатию и сохраняют `clientRequestId` до success.
- Сотрудники загружаются как backend array и добавляются по `{email, role}`.
- Audit отображает `eventType`, `description`, `actorName`, `createdAt` с русскими labels.
- Архивирование отправляет reason и актуальную document version с предупреждением.
- Admin list использует server-side `/api/admin/document-flow/access`, без client join и N+1 пользовательских access-запросов.
- Admin mutations отправляют фактические `newExpiresAt`/`planCode`/nested `limits` и `expectedVersion`; при действии version перечитывается из admin detail.
- История подписки подключена к `/subscriptions/{organizationId}/events`.
- Query scope рабочих данных включает `{userId, organizationId}`.
- Неподдерживаемое PATCH-редактирование контрагента удалено из UI; создание не отправляет organizationId в body.

## Изменённые файлы

Основные: `documentFlowApi.ts`, `contractSchemas.ts`, `documentFlowKeys.ts`, `types.ts`, `creationCheckpoint.ts`, `CreateDocumentPage.tsx`, `DocumentDetailsPage.tsx`, `ExternalSigningPage.tsx`, `MembersPage.tsx`, `CounterpartiesPage.tsx`, `SigningRouteBuilder.tsx`, `AuditTimeline.tsx`, `useDocumentFlowTenant.ts`, весь API/DTO экранов `document-flow-admin`, а также `tests/document-flow.test.tsx` и `tests/document-flow-admin.test.tsx`.

## Проверки

| Команда | Результат |
|---|---|
| `npm ci` | PASS, 366 packages |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, 2/2 |
| `npm run test` | PASS: Node 154 passed, 1 skipped; Vitest 227/227 |
| `npm run build` | PASS: 13,790 modules; production MSW/API checks PASS; prerender 62; SEO audit PASS |

Focused document-flow tests: 56/56.

## Подтверждённые backend gaps

1. `PATCH /api/document-flow/counterparties/{id}` отсутствует в фактическом controller. Редактирование скрыто, endpoint не выдуман.
2. DTO представителя контрагента не содержит `canSign`; право подписи не отправляется фиктивным полем.
3. Public challenge не содержит отправителя документа; UI не может достоверно показать его.
4. Subscription event DTO не содержит old/new plan, version и имени администратора — доступны только actorUserId/status/reason/time.
5. Admin list DTO не содержит usage/limits/subscriptionVersion/grantedBy. Список не выполняет N+1; detail запрашивается только перед mutation.
6. `send-for-signing` в фактическом backend не принимает `expectedVersion`; optimistic check на этом endpoint нельзя добавить только frontend-ом.

## Не выполненная внешняя проверка

В репозитории нет настроенного Playwright/Cypress и live test environment с Spring Boot, NCALayer и почтовым public token. Поэтому браузерный E2E с реальными сертификатами не запускался. Сценарии зафиксированы в `document-flow-e2e-scenarios.md`; unit/integration и production build проходят.
