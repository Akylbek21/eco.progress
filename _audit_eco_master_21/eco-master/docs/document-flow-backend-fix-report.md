# Document Flow backend fix report

## Security completion update — 7 August 2026

- JWT logout increments persistent `users.auth_token_version`; tokens issued before logout are rejected.
- Public signing rate-limit state is stored in the shared relational database instead of process memory.
- Docker CORS uses explicit production origins; H2 console is denied in docker/prod profiles.
- Archive now requires both `expectedVersion` and a non-empty reason.
- Added migrations `V71__user_auth_token_version.sql` and `V72__document_flow_distributed_rate_limit.sql`.
- Final command: `mvnw -Dtest=kz.ecoprogress.documentflow.**,kz.eco.auth.JwtTokenVersionTest test` — 136 tests, 0 failures, 0 errors.
- Production package: `mvnw -DskipTests package` — BUILD SUCCESS.

Дата проверки: 6 августа 2026.

## Найденные разрывы

- `DocumentListItemDto` не содержал `updatedAt`.
- `prepare-for-signing` блокировал файл, но не менял статус документа.
- `send-for-signing` мог вызываться без клиентской optimistic-lock версии.
- `DRAFT -> SENT_FOR_SIGNING` был разрешён status machine.
- Внутренняя подпись доверяла `documentId/versionId/assignmentId` из body вместо path и текущего пользователя.
- У контрагентов отсутствовал PATCH.

## Изменения

- List DTO теперь возвращает `updatedAt` из `Document.updatedAt`.
- Добавлен канонический статус `PREPARED_FOR_SIGNING`; legacy `READY_FOR_SIGNING` сохранён для совместимости данных.
- Prepare блокирует текущую версию и переводит документ в `PREPARED_FOR_SIGNING`.
- Send принимает `{expectedVersion}` и допускается только после prepare.
- Конфликт документа возвращает `DOCUMENT_VERSION_CONFLICT`.
- `POST .../{id}/signatures` использует path document id, активный маршрут, assignment JWT-пользователя и текущую locked version. Переданные legacy id лишь дополнительно сверяются.
- Добавлен tenant-isolated `PATCH /api/document-flow/counterparties/{id}` с проверкой версии и уникальности БИН.

## Проверки

```text
mvnw -DskipTests test-compile — BUILD SUCCESS
mvnw -Dtest=DocumentStatusTest,SigningFlowTest,CounterpartyServiceTest test
Tests run: 16, Failures: 0, Errors: 0 — BUILD SUCCESS
```

Полный модульный прогон:

```text
mvnw -Dtest=kz.ecoprogress.documentflow.** test
Tests run: 134, Failures: 0, Errors: 0 — BUILD SUCCESS
```

Полный результат document-flow и всего проекта указывается после финального прогона.
