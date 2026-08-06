# Отчёт об исправлении frontend ПЭК

Дата: 06.08.2026.

## Реализовано

- Доступ к разделу синхронизирован с фактическими `PekSecurityExpressions`; явный permissions-массив остаётся приоритетным.
- Добавлены централизованные `canViewPek`, `canEditPek`, `canReviewPek`, `canApprovePek`, `canManagePekSettings`.
- Меню и маршруты больше не закрывают ПЭК до окончания загрузки auth state и учитывают `MANAGER`/`ACCOUNTANT` для просмотра.
- Добавлены backend enum и русские labels для control type, periodicity, comparison type, measure status и report status.
- Удалена отправка `MAX`, `MIN`, `INFORMATIONAL`; старые локальные черновики мигрируются в `LESS_OR_EQUAL`, `GREATER_OR_EQUAL`, `INFO`.
- `RETURNED` поддержан в типах, dashboard и workflow.
- API envelope проверяет `success:false` единым helper.
- Единый ПЭК API дополнен sources, summary, manual match, exclude, restore, plan/fact, readiness, report return и settings.
- Результат collect больше не обрезается до отчёта: сохраняются counts, removed stale rows и warnings.
- Рабочая область отчёта получила реальные вкладки «Источники данных», «План / факт», «Превышения» и backend readiness.
- Workflow отчёта строится по `availableActions`, frontend permission и фактическому статусу backend после повторного GET.
- Return/exclude используют MUI Dialog с обязательной причиной; browser confirm не используется.
- Настройки ПЭК подключены к GET/PUT, поддерживают dirty/reset/version и backend capabilities.
- Query keys разделены по пользователю/company scope, а auth logout очищает весь `['pek']` cache.
- Dashboard не называет `overdueRiskCount` просроченными измерениями и не показывает неподдерживаемые backend KPI как реальные нули.

## Основные изменённые файлы

- `src/features/pek/permissions/pekAccess.ts`
- `src/features/pek/model/pekDictionaries.ts`
- `src/features/pek/types/pek.types.ts`
- `src/features/pek/api/pekContracts.ts`
- `src/features/pek/api/pekService.ts`
- `src/features/pek/api/pekMappers.ts`
- `src/features/pek/api/pekQueryKeys.ts`
- `src/features/pek/mappers/responseMappers.ts`
- `src/features/pek/pages/PekProgramCreatePage.tsx`
- `src/features/pek/pages/PekProgramDetailsPage.tsx`
- `src/features/pek/pages/PekReportWorkspacePage.tsx`
- `src/features/pek/pages/PekSettingsPage.tsx`
- `src/features/pek/pages/PekDashboardPage.tsx`
- `src/features/pek/validation/programSchema.ts`
- `src/features/pek/utils/pekDraftStorage.ts`
- `src/App.tsx`, `src/layouts/StaffLayout.tsx`
- `tests/pek-module.test.tsx`

## Проверки

Раздел заполняется фактическими результатами команд после финального запуска. Неуспешные/не запущенные проверки не отмечаются как пройденные.

| Проверка | Результат |
|---|---|
| Установка зависимостей | `npm install` — завершено, зависимости актуальны |
| TypeScript | `npm run typecheck` — пройдено, ошибок нет |
| Lint | `npm run lint` — пройдено, 2 проверки из 2 |
| PEK unit/integration | `npx vitest run tests/pek-module.test.tsx` — 30 тестов из 30 |
| Полный test suite | `npm run test` — Node: 154 пройдено, 1 пропущен; Vitest: 200 из 200 |
| Production build | `npm run build` — exit code 0; Vite собрал 13 788 модулей; production MSW/API-base и SEO audit пройдены |

## Ограничения

Подробный список подтверждённых ограничений — в `docs/pek-frontend-backend-gaps.md`. Вкладки без backend API показывают честное недоступное состояние, без mock-данных.
