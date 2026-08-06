# Отчёт: управление доступом к документообороту

Дата: 2026-08-05.

## Реализовано

- Административный маршрут `/admin/document-flow-access` и пункт меню «Доступ к документообороту».
- Ограничение маршрута фактической платформенной ролью `ADMIN`; `OWNER` организации не считается системным администратором.
- Серверный поиск организаций через существующий paged `/api/companies`; `organizationId` вручную не вводится.
- Таблица организаций, подписок, доступа, периода, остатка дней, usage/limits и данных выдачи.
- Фильтры статуса, тарифа, «Без доступа», «Истекает за 30 дней», сортировка/пагинация организаций и обновление.
- Диалоги обычной и бессрочной внутренней выдачи. INTERNAL использует реальный план backend, `expiresAt=null`, `paymentMode=ADMIN_GRANT` и подтверждение.
- Стабильный на одну попытку `Idempotency-Key`; кнопка блокируется во время запроса.
- После выдачи и каждой action-операции выполняется повторный `/api/document-flow/access`. Старое состояние не вызывает повторный POST; доступен только безопасный GET retry.
- Продление, смена плана/лимитов, приостановление, восстановление и отзыв через фактические subscription action endpoint.
- Для `409/412` данные повторно загружаются; `fieldErrors` и `traceId` выводятся пользователю.
- Карточка «Доступ к документообороту» в административном просмотре компании.
- Понятный экран «Доступ не подключён» для обычного пользователя и кнопка выдачи только для системного администратора.
- Раздельные Zod form/request/response/access schemas и изолированные React Query keys по организации.

## Сценарии

### Выдача

Администратор выбирает организацию autocomplete, выбирает один из активных backend-планов, задаёт период/причину/допустимые лимиты. Frontend один раз отправляет POST с idempotency key, затем проверяет access context. Успех подтверждается только при `available=true`, `readOnly=false`, `status=ACTIVE|TRIAL`, `reason=null`.

### Внутренний доступ

Выбирается реальный `organizationId`; название компании не анализируется. Форма фиксирует план `INTERNAL`, `ADMIN_GRANT`, бессрочный срок и требует явного подтверждения.

### Продление и изменение

Продление отправляет новую дату только после подтверждения. План и лимиты используют отдельные backend operations; после ответа выполняется GET access и инвалидация затронутых query.

### Приостановление, восстановление и отзыв

Все действия требуют причины. Отзыв дополнительно показывает предупреждение о потере доступа и сохранении документов. Frontend не удаляет документы, файлы, участников, историю или subscription record.

## Основные файлы

- `src/features/document-flow-admin/api/documentFlowAdminApi.ts`
- `src/features/document-flow-admin/api/documentFlowAdminSchemas.ts`
- `src/features/document-flow-admin/model/{types,queryKeys,permissions}.ts`
- `src/features/document-flow-admin/pages/DocumentFlowAccessAdminPage.tsx`
- `src/features/document-flow-admin/components/*`
- `src/features/document-flow/components/DocumentFlowGate.tsx`
- `src/pages/CompaniesPage.tsx`
- `src/layouts/AdminLayout.tsx`
- `src/App.tsx`
- `tests/document-flow-admin.test.tsx`

Полная endpoint/DTO матрица: `docs/document-flow-access-admin-contract.md`.

## Проверки

- Профильные тесты: 45/45 успешно (`document-flow-admin` + `document-flow`).
- Typecheck: успешно (`npm run typecheck`).
- Lint: 2/2 успешно (`npm run lint`).
- Production build: успешно (`npm run build`), включая production-no-MSW, production API base, prerender и SEO audit.
- Полный `npm test`: 154/155 Node tests прошли, выполнение остановлено до Vitest из-за существующего отсутствующего файла `backend/src/main/resources/db/migration/V5__create_content_management.sql` в тесте content management. Профильные document-flow тесты запущены отдельно и успешны; ошибка не относится к этому модулю.
- Реальный E2E POST не выполнялся без безопасной тестовой организации и авторизованного backend; это намеренно исключает изменение production-данных.

## Оставшиеся backend blockers

- audit/history API отсутствует в доступном контракте;
- server pagination/filtering подписок не подтверждены;
- optimistic locking token/ETag не подтверждён;
- admin membership listing произвольной организации не подтверждён;
- generic update grace period/payment reference не подтверждён;
- live source/OpenAPI нужен для окончательной проверки action request DTO.

Задача не подменяет backend-подписку frontend-флагом: проверка `available` сохранена, реальная выдача идёт через access-grants POST и подтверждается отдельным GET access.
