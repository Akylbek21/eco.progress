# Document Flow frontend integration report

Дата: 31.07.2026.

## Результат

Существующий redirect на отдельный EDO-кабинет заменён встроенным разделом EcoProgress. Внутренние запросы используют общий JWT Axios client, public token signing — отдельный client без JWT. Production mocks не добавлялись.

## Routes

- `/document-flow`
- `/document-flow/access`
- `/document-flow/plans`
- `/document-flow/documents`
- `/document-flow/documents/new`
- `/document-flow/documents/:id`
- `/document-flow/counterparties`
- `/document-flow/settings`
- `/document-flow/subscription`
- `/public/document-flow/sign/:token`
- `/admin/document-flow/plans`
- `/admin/document-flow/subscriptions`
- `/admin/document-flow/access-grants`

Admin routes дополнительно проверяют роль `ADMIN`.

## Используемые endpoints

### Access и тарифы

- `GET /api/document-flow/access`
- `POST /api/document-flow/access-requests`
- `GET /api/public/document-flow/plans`
- `GET /api/public/document-flow/plans/{code}`

### Документы

- `GET /api/document-flow/dashboard`
- `GET /api/document-flow/document-types`
- `GET /api/document-flow/documents`
- `POST /api/document-flow/documents`
- `GET /api/document-flow/documents/{id}`
- `PATCH /api/document-flow/documents/{id}`
- `DELETE /api/document-flow/documents/{id}`
- `POST /api/document-flow/documents/{id}/file`
- `GET /api/document-flow/documents/{id}/preview`
- `GET /api/document-flow/documents/{id}/download`

### Versions и attachments

- `POST /api/document-flow/documents/{id}/versions`
- `GET /api/document-flow/documents/{id}/versions`
- `GET /api/document-flow/documents/{id}/versions/{versionId}`
- `GET /api/document-flow/documents/{id}/versions/{versionId}/download`
- `POST /api/document-flow/documents/{id}/attachments`
- `GET /api/document-flow/documents/{id}/attachments`
- `DELETE /api/document-flow/documents/{id}/attachments/{attachmentId}`

### Контрагенты

- `POST /api/document-flow/counterparties`
- `GET /api/document-flow/counterparties`
- `GET /api/document-flow/counterparties/{id}`
- `DELETE /api/document-flow/counterparties/{id}`
- `POST /api/document-flow/counterparties/{id}/representatives`
- `GET /api/document-flow/counterparties/{id}/representatives`

### Signing

- `POST /api/document-flow/documents/{id}/signing-route`
- `GET /api/document-flow/documents/{id}/signing-route`
- `PUT /api/document-flow/documents/{id}/signing-route`
- `POST /api/document-flow/documents/{id}/prepare-for-signing`
- `POST /api/document-flow/documents/{id}/send-for-signing`
- `POST /api/document-flow/documents/{id}/cancel-signing`
- `GET /api/document-flow/documents/{id}/signing-data`
- `POST /api/document-flow/documents/{id}/signatures`
- `GET /api/document-flow/documents/{id}/signatures`
- `POST /api/document-flow/documents/{id}/signatures/verify-all`
- `GET /api/document-flow/documents/{id}/verification-report`
- `POST /api/document-flow/documents/{id}/reject`
- `POST /api/document-flow/documents/{id}/return-for-revision`
- `GET /api/document-flow/documents/{id}/signed-package`

### Public signing

- `GET /api/public/document-flow/signing/{token}`
- `GET /api/public/document-flow/signing/{token}/file`
- `POST /api/public/document-flow/signing/{token}/viewed`
- `POST /api/public/document-flow/signing/{token}/sign`
- `POST /api/public/document-flow/signing/{token}/reject`

Ограничение `/sign` описано в отдельном gap report.

### Revocation

- `POST /api/document-flow/documents/{id}/revocation-requests`
- `GET /api/document-flow/documents/{id}/revocation-requests`
- `POST /api/document-flow/revocation-requests/{requestId}/send`
- `POST /api/document-flow/revocation-requests/{requestId}/approve`
- `POST /api/document-flow/revocation-requests/{requestId}/reject`
- `POST /api/document-flow/revocation-requests/{requestId}/cancel`

### Admin

- `GET /api/admin/document-flow/plans`
- `POST /api/admin/document-flow/plans`
- `PATCH /api/admin/document-flow/plans/{planId}`
- `GET /api/admin/document-flow/subscriptions`
- `GET /api/admin/document-flow/subscriptions/{organizationId}`
- `POST /api/admin/document-flow/subscriptions/{organizationId}/extend`
- `POST /api/admin/document-flow/subscriptions/{organizationId}/suspend`
- `POST /api/admin/document-flow/subscriptions/{organizationId}/restore`
- `POST /api/admin/document-flow/subscriptions/{organizationId}/revoke`
- `POST /api/admin/document-flow/subscriptions/{organizationId}/change-plan`
- `POST /api/admin/document-flow/subscriptions/{organizationId}/limits`
- `POST /api/admin/document-flow/subscriptions/{organizationId}/entitlements`
- `POST /api/admin/document-flow/access-grants`

## Feature gates

- `DOCUMENT_FLOW`: основной access gate;
- `DOCUMENT_CREATE`: создание;
- `MULTI_SIGNING`: несколько подписантов в одном шаге;
- `SEQUENTIAL_SIGNING`: sequential route;
- `PARALLEL_SIGNING`: parallel route;
- `MIXED_SIGNING`: mixed route;
- `EXTERNAL_SIGNING`: external assignment;
- `NCALAYER_SIGNING`: внутренняя CMS-подпись;
- `DOCUMENT_TEMPLATES`: типы, где registry требует feature;
- `VERSIONING`: новая версия;
- `REVOCATION`: запрос и workflow отзыва;
- `CUSTOM_LIMITS`: лимиты отображаются из access context;
- `AUDIT_LOG`: UI не имитируется из-за отсутствующего read endpoint.

Дополнительно каждая mutation проверяет `access.readOnly`, permissions документа и `availableActions`, где backend их предоставляет.

## Изменённые файлы

- `src/App.tsx`
- `package.json`
- `src/vite-env.d.ts`
- `src/features/document-flow/DocumentFlowRoutes.tsx`
- `src/features/document-flow/AdminDocumentFlowRoutes.tsx`
- `src/features/document-flow/api/documentFlowApi.ts`
- `src/features/document-flow/api/documentFlowKeys.ts`
- `src/features/document-flow/model/types.ts`
- `src/features/document-flow/model/access.ts`
- `src/features/document-flow/mappers/documentMappers.ts`
- `src/features/document-flow/hooks/useDocumentFlowAccess.ts`
- `src/features/document-flow/components/AccessRequestForm.tsx`
- `src/features/document-flow/components/DocumentFlowGate.tsx`
- `src/features/document-flow/components/DocumentStatusBadge.tsx`
- `src/features/document-flow/components/SigningRouteBuilder.tsx`
- `src/features/document-flow/layout/DocumentFlowLayout.tsx`
- `src/features/document-flow/pages/DocumentFlowPricingPage.tsx`
- `src/features/document-flow/pages/DashboardPage.tsx`
- `src/features/document-flow/pages/DocumentsPage.tsx`
- `src/features/document-flow/pages/CreateDocumentPage.tsx`
- `src/features/document-flow/pages/DocumentDetailsPage.tsx`
- `src/features/document-flow/pages/CounterpartiesPage.tsx`
- `src/features/document-flow/pages/SubscriptionPage.tsx`
- `src/features/document-flow/pages/SettingsPage.tsx`
- `src/features/document-flow/pages/ExternalSigningPage.tsx`
- `src/features/document-flow/pages/AdminPages.tsx`
- `tests/document-flow.test.tsx`
- `docs/document-flow-backend-gaps.md`
- `docs/document-flow-integration-report.md`

Удалён неиспользуемый legacy-файл `src/features/document-flow/pages/DocumentFlowLandingPage.tsx`, который перенаправлял пользователя во внешний EDO-кабинет через `VITE_EDO_APP_URL`. Сам устаревший env-параметр также удалён из frontend-типов.

Отдельный каталог `edo-app` не изменялся и не используется новым route tree.

## Security

- public signing client не устанавливает JWT;
- token не сохраняется;
- CMS не сохраняется и не логируется;
- signature request собирается allow-list mapper-ом;
- `privateKey`, `password`, `pkcs12` не отправляются;
- `storageKey` и `previewStorageKey` отбрасываются API mapper-ом;
- preview Blob URL освобождается;
- ZIP создаётся только backend;
- `Idempotency-Key` стабилен на попытку создания документа/access grant.

## Проверки

- `npm run typecheck` — успешно.
- `npm run lint` — успешно, 2/2.
- `npm test` — успешно:
  - Node tests: 155/155;
  - Vitest: 127/127, 13/13 файлов;
  - Document Flow focused tests: 8/8.
- `npm run build` — успешно:
  - TypeScript;
  - Vite production build;
  - production-no-MSW;
  - prerender;
  - SEO audit.

Полный E2E с реальным backend/DB/NCALayer не запускался из-за недоступного backend стенда и блокирующего public signing DTO gap.
