# ПЭК: отчёт о frontend-реализации

Дата: 2026-08-05.

## Результат итерации

Реализована безопасная часть нового рабочего места в пределах подтверждённого backend-контракта. Полная задача не считается завершённой: актуальный OpenAPI защищён, а последний доступный контракт не предоставляет API plan/fact, readiness, sources matching, exceedances и corrective actions.

## Изменённые файлы

- `src/config/permissions.ts` — удалены role-based fallback permissions ПЭК;
- `src/features/pek/pages/PekDashboardPage.tsx` — task-oriented метрики, ближайшие задачи, корректное `Нет данных`;
- `src/features/pek/pages/PekProgramCreatePage.tsx` — ранний серверный DRAFT, ручное сохранение на каждом шаге, понятные состояния сохранения;
- `src/features/pek/pages/PekReportCreatePage.tsx` — текущий квартал, отдельный явный сбор, нет технических текстов;
- `src/features/pek/pages/PekReportWorkspacePage.tsx` — восемь целевых вкладок, обзор программы, только фактические номера протоколов, честные состояния отсутствующих ресурсов;
- `src/features/pek/validation/programSchema.ts` — обязательные control/frequency/unit/comparison поля, PER_EVENT и RANGE;
- `src/features/pek/utils/pekPeriod.ts` — единый расчёт текущего квартала;
- `src/features/pek/utils/pekErrorMapper.ts` — публичная единая граница `mapPekApiErrorsToUi`;
- `tests/pek-module.test.tsx`, `tests/pek-routes.test.mjs` — контрактные проверки;
- `docs/pek-frontend-contract-audit.md` — аудит.

## Новый пользовательский путь

1. На шаге «Основные данные» сотрудник выбирает компанию, объект, номер, название и период.
2. При продолжении создаётся реальный серверный DRAFT с пустыми коллекциями.
3. Пользователь продолжает работу в versioned edit route; изменения заголовка сохраняются через draft PATCH.
4. На каждом шаге доступно явное «Сохранить черновик».
5. Контрольные позиции не пропускаются без типа и периодичности; PER_EVENT требует плановое количество.
6. Проверка показателя учитывает единицу, comparison type, норматив и корректный RANGE.
7. При создании отчёта автоматически выбран текущий квартал; сбор остаётся отдельным явным решением.
8. Рабочая область имеет целевую навигацию и не смешивает потенциальные протоколы с фактически связанными.

## Mapping enum

Подтверждены только program/report statuses и period type из `pekContracts.ts`. Остальные значения в последнем Java DTO имеют тип `String`, а endpoint справочников отсутствует. Выдуманные enum не добавлены; это blocker для полной замены свободного ввода на Select.

## Permissions и workflow

- вход/создание: только auth permissions `PEK_*`;
- program workflow: только `program.availableActions`;
- report workflow: кнопки не добавлены, потому что подтверждённый `ReportResponse` не возвращает `availableActions`.

## Ошибки и version conflict

Существующий централизованный mapper сохранён и экспортирован как `mapPekApiErrorsToUi`. Он обрабатывает status, field errors, trace/request id и version conflict. Форма не перезаписывается автоматически; диалог предлагает оставить локальные данные или загрузить актуальную версию.

## Query invalidation

Создание серверного draft инвалидирует список программ. Полное сохранение обновляет программу, список и dashboard. Создание отчёта обновляет report cache, список отчётов и dashboard. Новые ключи plan/fact/readiness/sources не добавлены до появления контрактов.

## Проверки

Результаты команд должны обновляться после финального запуска:

- `npm run typecheck` — успешно, `tsc --noEmit`, exit code 0;
- `npx vitest run tests/pek-module.test.tsx` — 26/26 успешно;
- `node --test tests/pek-routes.test.mjs` — 4/4 успешно;
- полный Vitest-набор из `npm test` — 185/185 успешно;
- Node test suite — 154/155 успешно; один существующий content-management test падает из-за отсутствующего файла `backend/src/main/resources/db/migration/V5__create_content_management.sql`;
- общий `npm test` — exit code 1 из-за указанного отсутствующего backend-файла, до запуска Vitest в составной команде;
- `npm run build` — успешно, exit code 0: TypeScript, Vite production build, no-MSW/API-base checks, prerender 62 страниц, SEO audit 38 страниц;
- браузерный E2E — не запускался: нет доступного OpenAPI/authenticated backend fixture.

## Backend gaps

- актуальный доступный OpenAPI;
- report `availableActions`;
- dashboard actionable task links/row identifiers;
- plan/fact;
- persisted report sources и collection summary DTO;
- unmatched/ambiguous/manual matching/exclusion/stale;
- exceedances;
- corrective actions;
- readiness issues;
- report documents/history/return/comments;
- catalogs enum и monitoring points;
- подтверждённый PEK protocol context contract.
