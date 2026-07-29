# ПЭК: отчёт о готовности frontend

Дата проверки: 2026-07-29.

## Итог

Существующий модуль `src/features/pek` сохранён и укреплён; параллельная
реализация не создавалась. Frontend не подменяет ответы ПЭК mock-данными.

Полную production-готовность пока нельзя подтвердить: в репозитории нет
OpenAPI-схемы/сгенерированного PEK-клиента и нет доступного Spring Boot
окружения для contract/E2E-проверки. `api/generated` намеренно не содержит
самодельных DTO.

## Изменённые зоны

- `src/features/pek/api`: единая точка API, query keys/options, mutation
  options, error exports, optimistic locking через `If-Match`.
- `src/features/pek/types`: семантические PEK-типы.
- `src/features/pek/utils`: безопасные форматтеры и user/entity-scoped drafts.
- `src/features/pek/pages`: nullable company/object, permission-aware create
  actions, deep-link workspace, creation context, conflict recovery.
- `src/features/pek/components`: `EntityName`, отсутствие подмены `null` числом
  `0`, безопасный вывод результатов.
- `src/services/api.ts`: correlation ID для каждого запроса.
- `src/config/permissions.ts`, `src/App.tsx`: PEK permissions и route guards.
- `tests/pek-module.test.tsx`: `If-Match`, отсутствие `version` в mutation body,
  результат `0`, отрицательные числа, диапазоны и detection limit.

Legacy-компоненты не удалялись: ни один не был доказанно неиспользуемым без
backend contract и полного E2E.

## Карта маршрутов

- `/staff/pek` и `/staff/pek/dashboard` — dashboard.
- `/staff/pek/programs` — программы.
- `/staff/pek/programs/new` — создание.
- `/staff/pek/programs/:programId` — карточка.
- `/staff/pek/programs/:programId/edit` — редактор.
- `/staff/pek/programs/:programId/history` — история.
- `/staff/pek/reports` — отчёты.
- `/staff/pek/reports/new` — creation context и создание.
- `/staff/pek/reports/:reportId` — workspace (совместимый URL).
- `/staff/pek/reports/:reportId/workspace` — workspace.
- `/staff/pek/reports/:reportId/history` — история.
- `/staff/pek/reports/:reportId/preview` — реальный PDF preview.
- `/staff/pek/settings` — настройки.

Фильтры и активная секция workspace хранятся в query parameters.

## Используемые endpoint-группы

- `GET/POST /pek/programs`, `GET/PATCH /pek/programs/{id}`.
- program actions: `draft`, `documents`, `submit-review`, `return`, `approve`,
  `activate`, `archive`, `clone`, `history`.
- `GET/POST /pek/reports`, `GET/PATCH /pek/reports/{id}`,
  `GET /pek/reports/creation-context`.
- report workflow: `collect`, `validate`, `submit-review`, `start-review`,
  `return`, `accept-review`, `approve`, `recall-approval`, `prepare-signing`,
  `sign`, `submission`, `result`, `revision`, `archive`.
- report data: `collection-runs/latest`, `issues`, `sections/{code}`,
  `plan-fact`, `unmatched-sources`, `exceedances`, `manual-overrides`,
  `review-comments`, `documents`, `history`.
- exports: `preview.pdf`, `report.pdf`, `report.xlsx`, `report.json`,
  `archive.zip`.
- lookups: assignees and object permits.
- dashboard and settings.

Этот список отражает только уже существующие вызовы frontend. Совпадение с
backend должно быть подтверждено предоставленной OpenAPI-схемой.

## Исправленные несовместимости

- `company` и `object` считаются nullable; прямое небезопасное чтение заменено.
- `version` удаляется из mutation body и передаётся как `If-Match`.
- `0` больше не превращается в «нет данных».
- network/400/403/404/409/5xx проходят через единый mapper; для 5xx выводится
  correlation ID без stack trace.
- кнопки workflow по-прежнему определяет backend `availableActions`;
  route guards являются только UX-ограничением.
- сообщение о запуске сбора не показывается до подтверждённого backend-ответа.
- offline drafts привязаны к `userId` и `entityId`, содержат `savedAt`,
  удаляются после сохранения и не содержат CMS.

## Матрица fallback-ролей

Если backend вернул `user.permissions`, используется только этот список.
Fallback ниже нужен для старых ответов без permissions.

| Permission | ADMIN | DIRECTOR | HEAD | ECOLOGIST | LABORATORY | WASTE |
|---|---:|---:|---:|---:|---:|---:|
| PEK_VIEW | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PEK_PROGRAM_CREATE/EDIT | ✓ | ✓ | ✓ | ✓ | — | — |
| PEK_PROGRAM_ACTIVATE | ✓ | ✓ | ✓ | — | — | — |
| PEK_REPORT_CREATE/EDIT | ✓ | ✓ | ✓ | ✓ | — | — |
| PEK_REPORT_COLLECT | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| PEK_REPORT_REVIEW | ✓ | ✓ | ✓ | — | — | — |
| PEK_REPORT_APPROVE/SIGN | ✓ | ✓ | — | — | — | — |
| PEK_REPORT_SUBMIT | ✓ | ✓ | ✓ | ✓ | — | — |
| PEK_REPORT_EXPORT | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PEK_ADMIN | ✓ | — | — | — | — | — |

Backend остаётся окончательным источником разрешений.

## Пользовательский процесс

Dashboard ведёт в отфильтрованные списки. Эколог создаёт черновик программы,
заполняет позиции/показатели/мероприятия, проверяет и отправляет доступное
backend-действие. Creation context отчёта проверяет действующую программу,
blocking reasons и дубликат до POST. Workspace загружает сводку и секции,
запускает подтверждённый сбор, показывает план/факт, несопоставленные источники,
превышения, замечания и проверку. Согласование, возврат, утверждение, подпись,
экспорт, отправка, новая редакция и архив выполняются только через
`availableActions`; подписанный/read-only отчёт не редактируется.

## Backend-зависимости, которые блокируют критерий «полностью готово»

1. OpenAPI JSON/YAML и команда генерации TypeScript-клиента.
2. Подтверждение всех перечисленных paths, методов, DTO и error codes.
3. Документированный refresh-token endpoint/формат. Сейчас frontend не
   изобретает refresh flow; существующий общий API-клиент завершает сессию
   после 401.
4. DTO для контрольных точек, нормативного справочника, signatures,
   submissions, generated documents и collection run log/retry.
5. Backend HTML/PDF preview, multi-sign preparation/verification и NCALayer
   payload contract.
6. Тестовые пользователи/роли, данные и backend environment для полного E2E.

Без этих данных нельзя честно заявить отсутствие несуществующих endpoint,
полную типизацию generated contract, несколько подписей и успешный сквозной
E2E. Mock-success для закрытия этих пробелов не добавлялся.

## Проверки

- `npm run typecheck` — PASS.
- `npm run lint` — PASS, включая запрет explicit `any`.
- `npx vitest run tests/pek-module.test.tsx` — PASS, 16/16.
- `npm run build` — PASS; Vite build, prerender и SEO audit завершены.
- `npm test` — PEK и 259 остальных проверок проходят; один существующий
  тест вне ПЭК падает в `tests/protocol-signatures.test.tsx`: ожидает текст с
  лимитом `5`, mapper возвращает общий текст ошибки лимита подписи.

Скриншоты не приложены: без реального API и авторизованных тестовых данных они
показывали бы только error/permission states и не подтверждали бы основной
процесс.
