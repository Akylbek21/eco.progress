# Итоговый отчёт по frontend ПЭК v3

Дата проверки: 06.08.2026.

## Результат

Frontend приведён к подтверждённым контрактам `eco-master (18).zip`. Действия отчёта и источников учитывают одновременно frontend permission, backend `availableActions` и статус сущности. Фиктивные endpoint, история и значения dashboard не добавлялись.

## Основные исправления

- Исправлен порядок состояний настроек: loading, error, пустой ответ. Ошибки 403/404 больше не превращаются в бесконечную загрузку.
- Настройки доступны пользователям с `PEK_VIEW`; редактирование включается только при `availableActions.edit=true`.
- Разделены права редактирования, сбора, отправки, возврата, утверждения и архивирования отчёта. `LABORATORY` не получает submit/approve.
- Создан централизованный `PekReportActions`; workflow-кнопки больше не размазаны по вкладкам.
- Изменение источников разрешено только при `matchSources=true`, праве редактирования и редактируемом статусе отчёта.
- `STALE` отображается как отдельная устаревшая системная связь и не предлагается к восстановлению.
- Диалог ручного сопоставления требует сначала позицию программы, затем показатель этой позиции; после mutation инвалидируются серверные sources, summary, plan/fact, readiness, report и dashboard.
- Перед approve выполняется свежий readiness-запрос; blockers отображаются в диалоге, запрос утверждения не отправляется.
- Добавлены подтверждения archive/approve без `window.confirm`.
- Добавлена централизованная обработка кодов `PEK_REPORT_NOT_EDITABLE`, `PEK_REPORT_NOT_READY`, `PEK_PROTOCOL_NOT_ELIGIBLE`, `PEK_COMPANY_ACCESS_DENIED`, version conflict и validation errors.
- При конфликте версии старый запрос не повторяется автоматически; пользователь может обновить серверные данные или отменить локальные изменения.
- Query keys учитывают пользователя и компанию; при смене компании отменяются старые PEK-запросы и очищается выбранный объект.
- Dashboard не выдаёт неподдерживаемые KPI за реальные нули и использует корректные названия доступных процентов.
- Удалён фиктивный маршрут `/staff/pek/programs/:programId/versions`.
- Вкладка истории отчёта не имитируется, поскольку backend endpoint отсутствует.

## Изменённые файлы

- `src/App.tsx`
- `src/features/pek/api/pekContracts.ts`
- `src/features/pek/api/pekQueryKeys.ts`
- `src/features/pek/api/pekService.ts`
- `src/features/pek/components/workflow/PekReportActions.tsx`
- `src/features/pek/mappers/responseMappers.ts`
- `src/features/pek/pages/PekDashboardPage.tsx`
- `src/features/pek/pages/PekProgramsPage.tsx`
- `src/features/pek/pages/PekReportsPage.tsx`
- `src/features/pek/pages/PekReportWorkspacePage.tsx`
- `src/features/pek/pages/PekSettingsPage.tsx`
- `src/features/pek/permissions/pekAccess.ts`
- `src/features/pek/routes/PekLayout.tsx`
- `src/features/pek/utils/pekErrorMapper.ts`
- `tests/pek-module.test.tsx`
- `tests/pek-routes.test.mjs`
- `docs/pek-frontend-contract-matrix-v3.md`
- `docs/pek-frontend-remaining-backend-gaps.md`
- `docs/pek-frontend-final-fix-report.md`

## Проверки

Выполнены фактически:

```text
npm ci
added 366 packages
exit code 0

npm run typecheck
tsc --noEmit
exit code 0

npm run lint
2 tests passed
exit code 0

npm run test
Node: 154 passed, 0 failed, 1 skipped
Vitest: 15 files passed, 208 tests passed
exit code 0

npm run build
13789 modules transformed
production MSW check passed
production API base check passed
SEO audit: PASS
exit code 0
```

Первый полный test-run выявил один устаревший тест, требовавший отсутствующий backend-маршрут версий. Тест изменён так, чтобы подтверждать отсутствие фиктивного маршрута; повторный полный запуск прошёл.

## Тестовое покрытие изменений

Добавлены или обновлены проверки разделения ролей `LABORATORY`, приоритета `availableActions`, закрытых и `STALE`-источников, read-only настроек, порядка error/loading, RETURNED-состояния, readiness guard, company scope query keys, отсутствующих KPI и version conflict. Общий regression-набор дополнительно проверил разделы протоколов и документооборота.

Live E2E с реально запущенным backend и браузером в этом запуске не выполнялся. Автоматический production build и весь имеющийся unit/integration regression-набор прошли.

## Оставшиеся ограничения

Подробности: `docs/pek-frontend-remaining-backend-gaps.md`. Ключевые блокировки — несовпадение `LABORATORY collect` с backend `availableActions`, отсутствие истории и returnInfo отчёта, неполный source DTO, отсутствие явного companyId у settings и недостаточная серверная защита mutations закрытого отчёта.

