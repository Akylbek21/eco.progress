# Document Flow — backend gap report

Проверено по Java-коду последнего доступного архива `eco-master (8).zip` от 31.07.2026. Файл с точным именем `eco-master (8)(1).zip` в переданных каталогах отсутствует.

## Блокирующие gaps

### 1. Public signing не может сформировать корректный POST `/sign`

`PublicSigningService.PublicInvitationView` возвращает только:

- `documentId`;
- `documentTitle`;
- `roleCode`;
- `required`;
- `status`;
- `invitationExpiresAt`;
- `signingDeadline`.

При этом `SigningRouteDtos.SubmitSignatureRequest` и `SigningService.recordSignature()` обязательно требуют:

- `versionId`;
- `assignmentId`;
- `documentId`;
- `cms`;
- `clientRequestId`.

Public frontend не может безопасно получить `versionId` и `assignmentId`. Они не угадываются и не извлекаются из чужих данных. Просмотр файла, `/viewed` и `/reject` подключены; кнопка public CMS signing отключена до исправления DTO/backend flow.

Рекомендуемое исправление: вернуть безопасные `assignmentId`, `versionId` и signing bytes/hash в token-scoped response либо создать token-scoped signing challenge endpoint.

### 2. «Мне на подпись» и signing counters в списке не реализованы

`DocumentSpecifications` содержит явный `TODO-RECONCILE`: `signerId` и `requiresMySignature` принимаются контроллером, но не участвуют в SQL predicate.

`DocumentDtos.DocumentListItemDto` содержит аналогичный TODO и возвращает заглушки:

- `signedCount = 0`;
- `requiredCount = 0`;
- `requiresMySignature = false`.

Frontend не фильтрует текущую страницу локально и не объявляет раздел «Мне на подпись» рабочим. Реальный маршрут и подписи показываются через detail endpoints.

## Функциональные gaps

### 3. Attachment download отсутствует

Есть upload/list/delete, но нет download endpoint. Backend при этом сериализует entity со `storageKey`. Frontend удаляет `storageKey` из UI-модели и не строит прямой storage URL.

### 4. Archive action без archive endpoint

`DocumentPermissionService.availableActions()` может вернуть `ARCHIVE`, но `DocumentController` предоставляет только `DELETE /documents/{id}` для удаления DRAFT. Отдельного archive endpoint нет. Frontend не маскирует DELETE под архивирование и не показывает фиктивное archive-действие.

### 5. Audit log без read endpoint

Feature `AUDIT_LOG` и `DocumentFlowAuditService` существуют, но controller endpoint истории документа отсутствует. История не подменяется данными detail DTO.

### 6. Поиск контрагентов отсутствует

`GET /counterparties` принимает только `organizationId`, `page`, `size`; параметры BIN/name/query отсутствуют. Frontend не выполняет фильтрацию одной загруженной страницы.

### 7. Нет справочника участников организации для route builder

Signing route принимает `userId`, но Document Flow API не предоставляет endpoint списка доступных внутренних участников. Builder поддерживает backend payload и ручной `userId`, однако полноценный безопасный picker требует member lookup endpoint.

### 8. Multi-organization context неполон

`AccessContext` внутри backend содержит `organizationId`, но `AccessContextDto` его не возвращает. `/access` выбирает первую membership. При нескольких организациях frontend не может построить корректный selector только из Document Flow API.

### 9. Entity DTO раскрывает storage fields

Version и attachment endpoints возвращают JPA entities, содержащие `storageKey`/`previewStorageKey`. Frontend mapper намеренно отбрасывает эти поля. Рекомендуется отдельный безопасный response DTO.

## OpenAPI и integration verification

Живой backend `213.155.20.204:8080` во время проверки не принимал соединение (`curl` status `000`). Поэтому:

- `/v3/api-docs` и `/api/v3/api-docs` не были доступны;
- authenticated integration test list signing filters выполнить невозможно;
- gaps подтверждены непосредственно Java-кодом, DTO и `DocumentSpecifications`;
- полный E2E с реальной БД, NCALayer и invitation token не запускался.

