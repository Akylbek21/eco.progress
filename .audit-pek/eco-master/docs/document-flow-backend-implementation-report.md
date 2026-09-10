# Document Flow backend: implementation report

Дата проверки: 2026-08-06.

## Результат инвентаризации

Модуль уже реализован в `kz.ecoprogress.documentflow`; параллельный модуль не создавался. Общая identity-модель — `kz.eco.user.User`. Tenant — `Company`, доступ задаётся `DocumentFlowMembership` и `OrganizationSubscription`.

Основные существующие API:

- `POST /api/document-flow/access-requests` — заявка на подключение;
- `GET /api/document-flow/access`, `GET /api/document-flow/organizations` — пользовательский контекст;
- `POST /api/admin/document-flow/access-grants` — атомарная выдача доступа с `Idempotency-Key`;
- `/api/admin/document-flow/access` и `/api/admin/document-flow/subscriptions` — список, карточка, события и административные переходы;
- `/api/document-flow/members` и `/api/admin/document-flow/access/organizations/{organizationId}/members` — участники;
- `/api/document-flow/documents/**`, `/api/document-flow/counterparties/**` — документы и контрагенты;
- `/api/document-flow/documents/{id}/signing-*`, `/signatures`, `/api/public/document-flow/signing/**` — внутреннее и внешнее подписание;
- `/api/document-flow/documents/{id}/audit` и subscription events — история.

Контроллеры возвращают единый `ApiResponse<T>`. Административные операции защищены platform permission expressions; OWNER не приравнивается к platform ADMIN. `OrganizationResolver` требует явный organization context при нескольких memberships. `AccessContext.canOpenModule()` допускает только `ACTIVE` membership и действующую подписку.

## Выполненные изменения

- `AccessGrantRequest` расширен полями `ownerEmail`, `ownerFullName` с сохранением Java-совместимого конструктора старого контракта.
- `AdminSubscriptionService.grantAccess` в одной транзакции создаёт общий аккаунт, OWNER membership и одноразовое приглашение; для существующего аккаунта membership активируется без создания второй identity-модели.
- Ответ выдачи доступа дополнен `ownerUserId`, `membershipId`, `invitationId`.
- Добавлены `MembershipInvitation`, repository, service и статусы `INVITED/ACCEPTED/DECLINED/EXPIRED/REVOKED`.
- Публичное принятие: `POST /api/public/document-flow/invitations/{token}/accept`, body `{ "password": "..." }`. В БД хранится только SHA-256 token; срок — 3 суток; повторное использование запрещено.
- До принятия OWNER membership имеет `INVITED`, поэтому `/api/document-flow/access` не возвращает полноценный доступ. Принятие атомарно устанавливает BCrypt-пароль и переводит membership в `ACTIVE`.
- Исправлена классификация CMS с просроченным сертификатом: она сохраняет `EXPIRED_CERTIFICATE`, а не маскируется общим `INVALID_CMS`.
- Security test для пользователя без membership приведён к фактическому безопасному контракту `403 Forbidden`.

## Миграция

`V67__document_flow_membership_invitations.sql` создаёт таблицу приглашений, FK на membership и user, уникальный hash token, индексы по организации/email/status и optimistic-lock `version`. Rollback: сначала архивировать/экспортировать audit-значимые строки, затем удалить таблицу; автоматическое удаление данных миграцией не выполняется.

## DTO и статусы

Grant request: organization, plan, период, payment, limits, optional existing owner user id либо owner email/full name. Grant response сохраняет прежний плоский access contract и добавляет идентификаторы owner/membership/invitation. Subscription и membership уже имеют `@Version`; mutations подписки принимают ожидаемую version. Permission enum и available actions рассчитываются backend в access/document/admin DTO.

## Проверки

- `mvnw -DskipTests test-compile`: SUCCESS, 661 main + 106 test source files.
- `mvnw -Dtest="kz.ecoprogress.documentflow.**" test` до исправления двух найденных дефектов: 133 теста, 131 passed, 1 failure, 1 error. Исправлены неверное ожидание 400/403 и классификация expired CMS; повторный итоговый прогон указан ниже после выполнения.
- `mvnw -Dtest="MembershipInvitationServiceTest,CmsDocumentVerificationServiceTest,kz.ecoprogress.documentflow.document.DocumentFlowModuleApiTest" test`: SUCCESS, 9/9.
- `mvnw -DskipTests package`: SUCCESS; создан `target/eco-0.0.1-SNAPSHOT.jar`.

## Оставшиеся gaps

Следующие требования ТЗ не следует считать завершёнными без отдельной реализации и проверки:

- отсутствующий входной файл `docs/document-flow-backend-gaps.md` не найден в repository;
- email transport для membership invitation пока представлен transactional outbox, но реальная доставка почтой требует подключённого processor/provider;
- employee self-service ещё активирует существующий аккаунт сразу и не создаёт приглашение для неизвестного email;
- нет DB-level partial unique constraint для одной non-terminal subscription (есть pessimistic company-row lock и idempotency);
- public access request остаётся аутентифицированным и не имеет полного admin CRM workflow/rate limit из нового ТЗ;
- auth не содержит refresh-cookie, logout-all, forgot/reset/email verification и server-side session revocation;
- OpenAPI не покрывает весь перечисленный новый контракт;
- audit subscriptions не содержит гарантированно IP и traceId во всех событиях;
- signing challenge и дублирующие маршруты требуют отдельного совместимого deprecation-плана;
- production package и полный suite должны быть запущены после завершения перечисленных gaps.

Поэтому модуль на данном этапе не объявляется полностью соответствующим всем acceptance criteria нового ТЗ.
