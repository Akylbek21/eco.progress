# Документооборот: что требуется от backend

Дата аудита: 6 августа 2026 года.

## Область проверки

Проверены обе frontend-реализации документооборота:

- CRM-модуль `src/features/document-flow`;
- административный модуль `src/features/document-flow-admin`;
- отдельный кабинет `edo-app` для `edo.ecoprogress.kz`;
- общий auth-клиент, admin users, query keys, runtime-схемы и тесты;
- локальные документы контракта в `docs/` и `edo-app/docs/`;
- фактические ответы `GET /api/document-flow/organizations` и `GET /api/document-flow/access`, предоставленные при диагностике.

Java backend и актуальный авторизованный OpenAPI в текущем workspace отсутствуют. Поэтому ниже разделены:

- подтверждённые пробелы — frontend уже не может выполнить сценарий или прямо показывает contract blocker;
- неподтверждённые контракты — endpoint вызывается, но точный DTO/permission/enum нельзя доказать без актуального OpenAPI.

## Что backend уже предоставляет

Не требуется повторно создавать уже используемые возможности:

- список организаций пользователя и проверка доступа;
- публичный список тарифов;
- административные планы, подписки, выдача, продление, смена тарифа и лимитов, приостановление, восстановление и отзыв;
- список и базовые операции membership по `userId`;
- документы, файлы, версии, вложения, контрагенты;
- маршруты подписания, отклонение, возврат, архив, аудит документа, отзыв подписи;
- публичное приглашение на подписание, просмотр файла и отклонение.

Наличие endpoint ещё не означает, что полный пользовательский сценарий завершён. Главный пример: активная подписка существует, но `/access` возвращает недоступность, если пользователь не состоит в организации модуля.

## P0 — блокирует вход и начало работы

### 1. Нет цельного сценария «выдать подписку и владельца»

Текущий `POST /api/admin/document-flow/access-grants` принимает подписку и лимиты, но не подтверждает создание/привязку владельца. Администратор вынужден отдельно:

1. создать аккаунт через `/api/admin/users`;
2. получить его `userId`;
3. добавить membership через `/api/document-flow/members`;
4. активировать membership;
5. повторно проверить `/api/document-flow/access`.

Backend нужен атомарный бизнес-сценарий или строго документированная транзакционная orchestration-операция:

- организация;
- тариф и срок;
- `ownerEmail` или существующий `ownerUserId`;
- роль `OWNER`;
- создание либо безопасное связывание аккаунта;
- активная membership;
- результат с `subscriptionId`, `membershipId`, `userId`, `available/readOnly/status`.

Если любой этап не выполнен, операция не должна оставлять «активную подписку без владельца».

### 2. Нет нормального приглашения сотрудника по email

Подтверждённый create membership принимает только `{ organizationId, userId, role }`. Обычный владелец компании не знает внутренний `userId`; текущая страница вынуждена показывать поле «ID пользователя».

Backend требуется предоставить подтверждённый сценарий:

- пригласить по email и роли;
- создать invitation token с TTL;
- принять или отклонить приглашение;
- задать пароль при первом входе либо связать существующий аккаунт;
- повторно отправить приглашение;
- отозвать приглашение;
- вернуть статусы `INVITED`, `ACTIVE`, `DECLINED`, `EXPIRED` и разрешённые действия.

Также необходим серверный поиск существующих пользователей по email/ФИО. `GET /api/admin/users` сейчас используется как полный список с фильтрацией в браузере — это не масштабируется и раскрывает лишние аккаунты.

### 3. Не подтверждено право platform ADMIN управлять membership другой организации

Административная CRM вызывает tenant endpoint `/api/document-flow/members` с выбранным `organizationId`. Нужно явно подтвердить одно из двух:

- permission `DOCUMENT_FLOW_ACCESS_MANAGE` разрешает platform ADMIN управлять membership любой выбранной организации;
- существует отдельная административная операция с тем же назначением.

Роль организации `OWNER` не должна давать системный доступ ко всем компаниям. Tenant isolation и право на переданный `organizationId` обязаны проверяться backend на каждом запросе.

### 4. Нет безопасного жизненного цикла пароля сотрудника

CRM сейчас просит администратора придумать временный пароль и затем показывает его на экране. Для production backend нужен безопасный вариант:

- одноразовая ссылка установки пароля;
- срок действия токена;
- обязательная смена временного пароля;
- forgot/reset password;
- отзыв активных сессий после блокировки membership;
- отсутствие пароля в response и журналах.

Отдельный `edo-app` уже ожидает login, refresh-cookie, logout, forgot/reset password и email verification, но актуальный контракт этих операций не опубликован.

### 5. Backend допускает несколько активных подписок одной организации

В административном списке зафиксированы две подписки одной организации с одинаковым периодом и статусом `ACTIVE`. Один `Idempotency-Key` защищает только повтор конкретного запроса и не заменяет бизнес-инвариант.

Backend должен атомарно гарантировать единственную незавершённую подписку на организацию и модуль. При конфликте нужен `409` с кодом и ID существующей подписки. `/access` должен однозначно выбирать состояние и не зависеть от порядка строк в БД.

### 6. Контракт access/membership нестабилен

Фактический `/organizations` возвращал `organizationId`, `role`, `status`; часть frontend-кода ожидает `id`, `membershipStatus`, `permissions`. `/access` в CRM вызывается с `organizationId`, тогда как старые документы описывали server-side выбор первой membership.

Нужен один канонический DTO:

- `organizationId`, название, БИН;
- membership ID, роль и статус;
- subscription ID, план, статус и период;
- `available`, `readOnly`, `reason`;
- `features`, `permissions`, `availableActions`;
- `limits`, `usage`;
- список доступных организаций или однозначный активный organization context.

Необходимо отдельно определить поведение пользователя с несколькими организациями.

## P0 — блокирует подписание

### 7. Не опубликован точный signing challenge

Оба frontend-приложения не имеют подтверждённого DTO байтов, которые должен подписать NCALayer:

- CRM получает `/documents/{id}/my-assignment` и `/signing-data`, но не знает точный cryptographic payload;
- публичный flow получает `/public/document-flow/signing/{token}/challenge` как `unknown`;
- `edo-app` ожидает `{ assignmentId, version, hash, dataBase64, detached }`, но его собственный комментарий указывает, что backend возвращает другую форму.

Нужен канонический challenge response как минимум с:

- document ID и immutable version ID;
- assignment ID;
- точными `dataToSign`/base64 bytes или hash и однозначным правилом подписи;
- алгоритмом, detached/attached profile и encoding;
- nonce, `expiresAt`, `clientRequestId`/idempotency rules;
- данными сертификата, которые backend будет проверять, и понятными error codes.

Submit DTO также должен быть единым. Сейчас в коде одновременно встречаются:

- глобальный `POST /api/document-flow/signatures` с `documentId/versionId/assignmentId/cms/clientRequestId`;
- `POST /api/document-flow/documents/{id}/signatures` с `version/hash/cmsSignatureBase64`;
- public token POST только с `cms/clientRequestId` либо со старым `version/hash/cmsSignatureBase64`.

До публикации точного контракта CRM намеренно не запускает NCALayer.

### 8. Конфликтуют endpoints подготовки и отправки

Одна реализация вызывает `/documents/{id}/send`, другая — `/documents/{id}/send-for-signing`; старый snapshot контракта также содержал `/prepare-for-signing`. Нужно зафиксировать один workflow:

`DRAFT → route created → prepared/locked → sent → assignments active`.

Для каждого перехода нужны request/response DTO, `version`/`If-Match`, idempotency и `availableActions`. Frontend не должен угадывать, является ли подготовка отдельной операцией.

### 9. `availableActions` должен покрывать весь workflow

Document detail должен возвращать действия с учётом текущего пользователя и assignment:

- `SIGN`, `REJECT`, `RETURN_FOR_REVISION`;
- `SEND`, `CANCEL_SIGNING`;
- `DOWNLOAD_SIGNED_PACKAGE`, `ARCHIVE`;
- создание, согласование, отклонение и отмена отзыва.

Необходимо унифицировать названия. Сейчас два клиента используют разные permissions и actions (`VIEW_DOCUMENTS` против `DOCUMENT_VIEW`, `MANAGE_MEMBERS` против `MEMBER_MANAGE`, `SEND` против `DOCUMENT_SEND`).

## P1 — административное управление

### 10. Нет административного списка и workflow заявок на подключение

Публичная форма умеет только POST. Поля организации и БИН сейчас упаковываются внутрь `comment`, потому что request DTO их не содержит.

Backend требуется:

- отдельные поля `organizationName`, `binIin`, contactName, phone, email, requestedPlan, membersCount, comment;
- response с ID, статусом и временем создания;
- административный серверный список с поиском, фильтрами и pagination;
- detail и действия взять в работу, связать с существующей организацией, одобрить, отклонить;
- причина решения, исполнитель, timestamps и audit;
- защита публичного POST: rate limit и anti-abuse;
- после одобрения — связь с созданной подпиской и владельцем.

### 11. Список подписок не поддерживает серверную таблицу CRM

`GET /api/admin/document-flow/subscriptions` используется как непагинированный массив. Организации приходят отдельной страницей, а фильтры по тарифу/статусу применяются только к текущей странице. Для каждой строки дополнительно запрашивается access.

Нужен paged admin DTO с server-side:

- поиском по названию и БИН;
- фильтрами status, plan, «без доступа», «истекает за 30 дней»;
- сортировкой и pagination;
- organization summary, subscription, access, limits/usage и grantedBy в одной строке.

Это также устранит N+1 запросы `/access`.

### 12. Нет backend-истории подписки

Текущая кнопка «История» показывает blocker. Нужен immutable audit организации:

- кто и когда выдал доступ;
- старый/новый тариф, период, лимиты и статус;
- причина выдачи, продления, приостановления, восстановления и отзыва;
- IP, correlation/trace ID;
- pagination.

Frontend-only история недопустима.

### 13. Не подтверждён optimistic locking подписки

Response допускает `version`, но mutation-запросы её не передают, потому что контракт не подтверждён. Нужен обязательный `version` или `If-Match` для изменения тарифа, лимитов, срока и статуса. При `409/412` backend должен вернуть код конфликта и актуальную версию/снимок.

### 14. Изменение подписки неатомарно

Смена тарифа и лимитов сейчас выполняются двумя последовательными запросами. Первый может пройти, второй — завершиться ошибкой. Также нет подтверждённого изменения `graceEndsAt`, `paymentReference` и административной причины одной операцией.

Нужен атомарный update подписки либо подтверждённая транзакционная команда. Ответ должен содержать итоговый subscription и актуальный access context.

### 15. Admin actions вычисляются по статусу во frontend

Subscription DTO не содержит `availableActions`, поэтому UI решает локально, когда показать «приостановить», «восстановить» и «отозвать». Backend должен возвращать разрешённые действия для каждой подписки с учётом status, permission и бизнес-правил.

### 16. Нет подтверждённого управления тарифами

Чтение планов есть. Create/update/archive plan, feature matrix и валидация лимитов не имеют подтверждённого актуального DTO. Если тарифы должны редактироваться из CRM, backend должен опубликовать точные операции, permission и versioning. До этого frontend не должен восстанавливать старую дублирующую форму.

## P1 — работа организации

### 17. Для документа без подписи нет подтверждённого завершения

Если тип документа имеет `signingRequired=false`, frontend может сохранить только DRAFT. Нужен backend action, переводящий заполненный документ в готовое/опубликованное состояние без фиктивного signing route, и соответствующий `availableAction`.

### 18. Представители контрагента поддержаны только частично

Есть list/create, но нет подтверждённых операций:

- изменить представителя;
- активировать/деактивировать;
- признак и проверка права внешней подписи;
- доступные действия и version conflict.

### 19. Нужны server-side справочники участников для выбора подписантов

Route builder должен получать только доступных активных участников выбранной организации с поиском, ролью/правом подписи и pagination. Backend обязан повторно проверить membership и permission при сохранении маршрута. Нельзя принимать произвольный `userId` как достаточное доказательство доступа.

### 20. Не подтверждены настройки модуля

Страница настроек сейчас честно показывает отсутствие API. Для отдельного `edo-app` также заявлены профиль организации, безопасность, уведомления, сессии и шаблоны, но реальные endpoints отсутствуют либо не подтверждены.

Если эти разделы входят в продукт, нужны отдельные versioned DTO и `availableActions` для:

- профиля организации;
- шаблонов;
- notification preferences;
- MFA/password/security policy;
- активных сессий и их отзыва;
- настроек хранения и подписания.

### 21. Management endpoints отдельного `edo-app` отсутствуют

`edo-app` имеет routes для members, invitations, templates, audit, revocation requests и settings, но его adapter разрешает запрос только `counterparties`, чтобы не отправлять заведомые 404. Часть этих возможностей уже реализована в CRM-модуле по другим URL, следовательно backend должен не обязательно создать новые endpoints, а сначала опубликовать единый контракт и перевести оба клиента на него.

## P1 — единый контракт для двух frontend-приложений

### 22. `edo-app` ожидает другой auth и tenant API

Отдельный кабинет ожидает:

- `/auth/login`, `/auth/me`, `/auth/refresh`, logout/logout-all;
- register, verify email, forgot/reset password;
- `/organizations`, `/organizations/active`;
- `X-Organization-Context`.

Основная CRM использует другой auth context и передаёт `organizationId` в query/body. Backend-команда должна выбрать и опубликовать один способ для EDO. Особенно важно определить, будет ли кабинет использовать общие аккаунты EcoProgress или отдельную identity-модель.

### 23. Разные response envelopes и enum

CRM ожидает ответы вида `{ success, data }` и выполняет unwrap. `edo-app` часто типизирует `response.data` сразу как ресурс. Одновременно расходятся:

- роли `DOCUMENT_FLOW_ADMIN` и `ORGANIZATION_ADMIN`;
- permissions `VIEW_DOCUMENTS` и `DOCUMENT_VIEW`;
- action names и статусы;
- строковые/числовые ID;
- page DTO.

Нужен опубликованный OpenAPI как единственный источник. В `edo-app` уже настроен generator, но generated client отсутствует и `api:check` намеренно не может стать зелёным без схемы.

## P2 — надёжность и эксплуатация

### 24. Единый структурированный error contract

Для всех операций нужен безопасный ответ:

```json
{
  "code": "DOCUMENT_FLOW_ERROR_CODE",
  "message": "Понятное сообщение",
  "fieldErrors": [{ "field": "email", "message": "..." }],
  "traceId": "...",
  "resourceId": 123,
  "currentVersion": 4
}
```

Нужны стабильные коды для duplicate subscription/membership, limit exceeded, version conflict, expired invitation, wrong organization context, signing challenge expired и certificate rejected.

### 25. Лимиты должны применяться backend атомарно

`ACTIVE_MEMBERS`, `DOCUMENTS_CREATED`, storage и signatures нельзя контролировать только значениями `/access`. Backend обязан проверять лимит внутри create/activate/upload/sign transaction и возвращать `422`/`409` с metric, limit и usage.

### 26. События и доставка уведомлений

Не подтверждены статусы доставки:

- приглашения владельца/сотрудника;
- внешнего приглашения на подпись;
- уведомления о скором окончании подписки;
- назначение на подпись, отклонение и возврат;
- приостановление/отзыв доступа.

Нужны backend events, retry/delivery status и audit; frontend не должен считать отправку email успешной по факту создания записи.

### 27. Семантика отзыва подписки

Backend должен гарантировать soft revoke: документы, файлы, подписи, membership и audit физически не удаляются. `/access` после операции должен отражать фактический read-only/denied режим согласно бизнес-правилу.

## Минимальный backend-пакет для текущей задачи сотрудников

Чтобы администратор мог выдать доступ и сотрудник действительно вошёл, достаточно сначала закрыть следующий вертикальный срез:

1. Канонический auth/session contract для кабинета EDO.
2. Invite-by-email или атомарное создание аккаунта с безопасной установкой пароля.
3. Create/activate membership с ролью и серверной проверкой лимита.
4. Право platform ADMIN управлять выбранной организацией.
5. Атомарная выдача subscription + OWNER membership либо надёжная orchestration с rollback.
6. Уникальная активная подписка на организацию.
7. Канонический `/organizations` + `/access`, после которого возвращается `available=true`, `readOnly=false`, `status=ACTIVE`.

Только после этого кнопка «Войти» сможет стабильно приводить владельца и сотрудников в кабинет, а не на экран «приглашение не принято» или «нет membership».

## Файлы-доказательства

- `src/features/document-flow/api/documentFlowApi.ts`
- `src/features/document-flow/model/types.ts`
- `src/features/document-flow/components/AccessRequestForm.tsx`
- `src/features/document-flow/components/DocumentFlowGate.tsx`
- `src/features/document-flow/pages/MembersPage.tsx`
- `src/features/document-flow/pages/DocumentDetailsPage.tsx`
- `src/features/document-flow/pages/ExternalSigningPage.tsx`
- `src/features/document-flow/pages/SettingsPage.tsx`
- `src/features/document-flow/model/creationCheckpoint.ts`
- `src/features/document-flow-admin/api/documentFlowAdminApi.ts`
- `src/features/document-flow-admin/components/OrganizationMembersDialog.tsx`
- `src/features/document-flow-admin/pages/DocumentFlowAccessAdminPage.tsx`
- `src/services/adminUserService.ts`
- `edo-app/src/features/auth/api/authApi.ts`
- `edo-app/src/features/organizations/api/organizationsApi.ts`
- `edo-app/src/features/documents/api/documentsApi.ts`
- `edo-app/src/features/signing/api/signingApi.ts`
- `edo-app/src/features/signing/api/externalSigningApi.ts`
- `edo-app/src/features/management/api/managementApi.ts`
- `edo-app/src/shared/types/domain.ts`
- `edo-app/docs/frontend-architecture.md`

## Ограничение аудита

Это анализ frontend-контрактов и доступных локальных документов. Перед backend-разработкой нужно выгрузить актуальный авторизованный OpenAPI либо добавить Java controller/DTO в workspace и подтвердить точные URL, enums, permissions и response envelopes. Новые URL в этом документе намеренно не придуманы.
