# EcoProgress EDO — аудит и архитектура отдельного frontend

## Граница системы

Новая система находится в `edo-app/` и имеет собственные:

- `package.json`, Vite entry и production build;
- env validation;
- API client;
- cookie-based auth bootstrap и refresh queue;
- модель пользователя, организаций, ролей и permissions;
- router с каноническим кабинетом `/app`;
- MUI theme;
- Dockerfile и Nginx virtual host для `edo.ecoprogress.kz`;
- unit и Playwright test configuration.

Основная CRM не импортируется и не является auth provider.

## Переиспользовано концептуально

- фирменная палитра EcoProgress;
- безопасный API error mapper;
- Blob/File вместо Base64 state;
- алгоритм подключения к NCALayer;
- TanStack Query для server state;
- UX loading/error/empty/retry.

## Изолировано

- `src/contexts/AuthContext.tsx` основной CRM;
- `src/services/api.ts` и CRM JWT/localStorage;
- CRM `UserRole`, permission matrix и staff/client guards;
- `/staff`, `/client`, `/cabinet`;
- таблицы пользователей и внутренние API основной CRM;
- ранее созданный встроенный `/edo` удалён из основной SPA.

## Архитектура auth

1. `POST /api/auth/login`.
2. Access token остаётся только в памяти.
3. Refresh token ожидается в HttpOnly Secure cookie.
4. `GET /api/auth/me` загружает пользователя и memberships через TanStack Query.
5. Router проверяет email, onboarding и active organization.
6. Параллельные 401 объединяются в один refresh Promise.
7. `SESSION_REVOKED` и `ORGANIZATION_ACCESS_REVOKED` очищают Query cache и открывают `/session-expired`.

## Multi-tenant

Active organization хранится в неперсистентном Zustand UI/auth bootstrap store. Переключение подтверждается backend, затем tenant-scoped Query cache очищается. `organizationId` из URL не используется как источник доступа.

## Маршруты

Публичные:

- `/login`
- `/register`, `/register/organization`
- `/verify-email`, `/resend-verification`
- `/forgot-password`, `/reset-password`
- `/invitations/:token`
- `/external-sign/:token`
- `/privacy`, `/terms`
- `/access-denied`, `/session-expired`

Защищённые:

- `/select-organization`, `/onboarding`
- `/app/dashboard`
- `/app/incoming`, `/app/incoming/:documentType`
- `/app/outgoing`, `/app/outgoing/:documentType`
- `/app/requires-my-signature`, `/app/drafts`, `/app/archive`
- `/app/documents/create`, `/app/documents/:documentId`
- `/app/documents/:documentId/sign|history|versions`
- `/app/revocation-requests`, `/app/revocation-requests/:requestId`
- `/app/counterparties`, `/app/counterparties/:counterpartyId`
- `/app/members`, `/app/invitations`, `/app/templates`, `/app/audit`
- `/app/settings/profile|organization|security|notifications|sessions`

## Реализованные потоки

- отдельный login с безопасными кодами ошибок и requestId;
- четырёхшаговая регистрация пользователя и организации с Zod/RHF;
- email verification/resend;
- forgot/reset password без раскрытия существования email;
- organization selector и tenant cache reset;
- onboarding;
- permissions-based sidebar и route guards;
- dashboard;
- server-side списки и URL filters;
- восьмишаговый document wizard, File upload и Idempotency-Key;
- document details, route, version/hash/immutability;
- detached CMS через NCALayer и обязательная backend verification;
- external signer layout без tenant navigation;
- members, invitations, counterparties, revocations, templates, audit, settings boundary pages.

## Отсутствующие backend возможности

В предоставленном репозитории нет отдельного backend ЭДО и OpenAPI schema. Поэтому нельзя подтвердить:

- реальные регистрацию, email delivery, sessions и tenant isolation;
- CRUD сотрудников/контрагентов/шаблонов;
- server drafts/autosave/version conflict;
- PDF/DOCX preview;
- real signing data и CMS validation;
- revocation workflow и notifications;
- backend-to-backend CRM integration;
- полные integration/E2E сценарии.

Frontend не создаёт synthetic success и не содержит production mock fallback.

## Результаты проверки

- `npm run typecheck` — успешно;
- `npm run lint` — успешно;
- `npm test` — 6 unit-тестов успешно;
- `npm run build` — production-сборка успешно;
- `npm run e2e` — 6 публичных desktop/mobile сценариев успешно;
- визуально проверены login и первый шаг регистрации на desktop/mobile.

Защищённые пользовательские сценарии нельзя корректно пройти без EDO backend,
реальной cookie-сессии, OpenAPI schema и NCALayer. Они реализованы как frontend
границы и не подменены моками.
