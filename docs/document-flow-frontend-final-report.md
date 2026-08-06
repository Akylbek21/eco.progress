# Document Flow frontend final report

Дата: 2026-08-05.

## Выполнено

- Исправлен исходный сбой открытия раздела: `AccessContext` принимает фактический расширенный backend response, включая organization/membership и дополнительные поля, без fallback-доступа.
- Добавлен обязательный выбор организации, автоподстановка единственной организации, проверка сохранённого ID и tenant-scoped React Query cache.
- Удалён искусственный tenant на основе user ID; `organizationId` передаётся в доступ, документы, файлы, dashboard, members и counterparties.
- Список документов сохраняет `signedCount`, `requiredCount`, `rejectedCount`, `requiresMySignature`, `updatedAt` и `availableActions`.
- UI действий переведён на backend enum (`SEND`, `SIGN`, `REJECT`, `RETURN_FOR_REVISION`, `DOWNLOAD_SIGNED_PACKAGE`, `VIEW_AUDIT`, `ARCHIVE` и revocation actions).
- Members blocker заменён серверным списком, фильтрами, pagination, create/role/activate/deactivate UI и обработкой backend errors.
- В маршруте подписания внутренний участник выбирается серверным поиском и отправляется как `memberId`; внешнему подписанту валидируется email.
- Подключены `my-assignment`, audit, archive, signed ZIP и скачивание вложений.
- Контрагенты получили server-side search с debounce, status/sort/page filters, create/edit/archive; форма документа больше не ограничена заранее загруженными первыми 20 записями.
- Public signing использует token-only context/challenge URL; старый public sign payload с document/version/assignment IDs удалён.
- `/document-flow/plans` доступен без module access gate; добавлен dashboard route и tenant-aware navigation.
- Production API base и nginx `/api` proxy исправлены ранее в этой же работе; Vite development proxy отделён от публичного `VITE_API_URL`.

## Осознанно не имитировано

- NCALayer submit не включён без актуального Java DTO challenge и реализации backend CMS verification. Кнопка показывается только при `SIGN`, но остаётся заблокированной с явным contract blocker. Это предотвращает криптографически неверную подпись другого payload.
- Write DTO members и update counterparty помечены в матрице как требующие финальной сверки по актуальному Java/OpenAPI. Endpoint surface взят из задания, не из устаревшего snapshot.
- `edo-app` не удалялся: это отдельное потенциально пользовательское дерево, а безопасное удаление требует подтверждения ownership и полного переноса проверенного NCALayer контракта.

## Проверка

- `npx tsc --noEmit` — успешно.
- `npx vitest run tests/document-flow.test.tsx` — 35/35 успешно.
- Полный `npm test` запускает legacy Node tests до Vitest и сейчас падает на отсутствующем вне этой задачи файле `backend/src/main/resources/db/migration/V5__create_content_management.sql`.
- `npm run build` — успешно, включая TypeScript, Vite production bundle, same-origin API check, prerender и SEO audit.
- `npm run lint` — 2/2 проверки успешно.

Полная таблица контрактов и blockers: `docs/document-flow-frontend-contract-matrix.md`.
