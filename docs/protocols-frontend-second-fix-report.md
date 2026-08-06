# Протоколы: отчёт по второй итерации frontend-исправлений

Дата проверки: 06.08.2026.

Backend использовался только для чтения. Контракты сверены с `ProtocolController`, DTO черновиков, `SecurityExpressions` и контроллером нормативов из `eco-master (18).zip`.

## Первоначальные причины дефектов

- Локальная матрица ролей расходилась с `SecurityExpressions.LAB_PROTOCOL`: `HEAD` и `LABORATORY` не могли создать протокол, а `WASTE_SPECIALIST` получал недоступное backend-действие.
- Server draft запускался после выбора одного типа, хотя компания после создания черновика неизменяема.
- Idempotency-Key создавался внутри каждой попытки POST, поэтому timeout мог привести к повторному черновику.
- Аварийная копия записывалась в `sessionStorage`, но не восстанавливалась.
- `canView` ошибочно использовался как разрешение на скачивание документов.
- React Query key поиска нормативов описывал не весь фактический request.
- Полный редактор всегда искал только `ACTIVE` и не давал осознанно расширить поиск.
- Autosave не имел явных состояний и мог отменить debounce уже после установки признака начатого POST.

## Изменённые файлы

### Доступ и маршруты

- `src/config/permissions.ts`
- `src/App.tsx`
- `src/pages/ProtocolsPage.tsx`
- `src/utils/protocolPermissions.ts`
- `src/components/protocols/ProtocolList.tsx`

### Черновик и мастер

- `src/features/protocols/api/protocolContracts.ts`
- `src/features/protocols/api/saveProtocolWizardDraft.ts`
- `src/features/protocols/components/CreateProtocolWizardModalV2.tsx`
- `src/features/protocols/components/steps/BasicDataStep.tsx`
- `src/features/protocols/mappers/protocolWizardDraftMapper.ts`
- `src/features/protocols/utils/protocolDraftRecovery.ts`
- `src/services/protocolService.ts`
- `src/services/apiProtocolService.ts`

### Нормативы

- `src/services/normativeSearchService.ts`
- `src/features/protocols/components/components/NormativeSelectorModal.tsx`
- `src/components/protocols/ProtocolResultsTable.tsx`

### Тесты и запуск

- `tests/protocol-second-fix.test.ts`
- `tests/protocol-overhaul.test.ts`
- `tests/protocol-wizard-v2.test.ts`
- `tests/normative-search.test.mjs`
- `tests/normative-crm-audit.test.mjs`
- `package.json`

Существовавшие до этой итерации изменения ПЭК в рабочем дереве не перезаписывались и не удалялись.

## Матрица ролей

| Роль | Просмотр существующего ресурса | Создание | Редактирование | Удаление | Генерация/скачивание | Подписание |
| --- | --- | --- | --- | --- | --- | --- |
| ADMIN | по `protocol.permissions` | да | да | да | да | да |
| DIRECTOR | по `protocol.permissions` | да | да | да | да | да |
| HEAD | по `protocol.permissions` | да | да | да | да | да |
| LABORATORY | по `protocol.permissions` | да | да | да | да | нет |
| MANAGER / ACCOUNTANT / ECOLOGIST / WASTE_SPECIALIST / STAFF | только по backend permissions | нет | нет | нет | нет | нет |

Кнопка, query-параметр `?create=1` и прямые маршруты `/staff/protocols/create`, `/staff/protocols/new` используют одно разрешение `create_protocols`.

## Создание server draft и компания

Server draft создаётся только при условии:

```ts
Boolean(values.templateId && values.companyId)
```

До этого мастер сохраняет только локальную копию и сообщает «Локальная копия сохранена». `CreateProtocolDraftRequest.companyId` имеет тип `number`; mapper дополнительно отклоняет вызов без компании.

После успешного POST компания блокируется. UI объясняет неизменяемость и предлагает «Начать новый протокол». Новый мастер очищает только свою локальную копию, оставляет уже созданный server draft в списке и получает новый Idempotency-Key. `companyId` отсутствует в `UpdateProtocolDraftRequest` и PATCH mapper.

## Жизненный цикл Idempotency-Key

Ключ создаётся один раз при запуске чистого мастера, хранится в ref и локальном envelope. Первичный POST, ручной retry, сетевой retry и повтор после timeout используют один ключ. API-функция UUID не создаёт. После подтверждённого POST локальная запись `new` удаляется. Новый мастер получает новый ключ.

## Восстановление sessionStorage

Ключ имеет формат:

```text
protocol-draft:<userId>:<protocolId-or-new>:4
```

Envelope содержит пользователя, protocolId, backend version, Idempotency-Key, шаг, форму, результаты, type-specific conditions, order/ПЭК UX-контекст, дату и dirty-признак. Копии старше 7 дней, другой schemaVersion или другого пользователя игнорируются.

При наличии server draft выполняется GET и сравнение version. Более новая серверная версия не затирается: пользователь выбирает серверную версию, локальную для сравнения или удаление копии. Локальная версия для сравнения открывается в состоянии `CONFLICT`, поэтому autosave остановлен.

После успешного завершения удаляются только ключи текущего пользователя и текущего протокола.

## Правила скачивания

`canView` больше не означает `canDownload`. Frontend fail-closed повторяет backend role guard download endpoints: `ADMIN`, `DIRECTOR`, `HEAD`, `LABORATORY`, одновременно требуя `protocol.permissions.canView === true`.

Правило применяется в списке, основной кнопке, меню, карточке и вкладке документов через общий `getProtocolPermissions`/`canDownloadProtocolDocument`.

## Normative query key

`normativeSearchQueryKey()` получает весь нормализованный HTTP request. Нормализация удаляет только `undefined`, `null` и пустые строки, сохраняет `0`/`false`, сортирует ключи и массивы. В key входят фактические поля запроса, включая `query`, `templateId/protocolType`, `factorType`, `status`, `page`, `size`, `waterType`, `waterUseCategory`, `season`, `lightingType`, `noiseType`, `visualWorkCategory`, `workCategory`, `roomType`, `workplaceType`, `normLevel`, `environmentType`, `factorCode`, `unit`, `pollutantCode` и остальные переданные backend-фильтры.

Изменение `normLevel` или `visualWorkCategory` создаёт новый query key и запрос.

## ACTIVE → ALL

Первый поиск полного редактора всегда отправляет backend status `ACTIVE`. При пустом результате доступна явная кнопка «Искать также архивные и требующие проверки», после которой отправляется `ALL`. Frontend-состояния `ACTIVE_ONLY`/`ALL_STATUSES` в API не передаются. При изменении строки поиска режим сбрасывается. Неактивные записи отмечены и не выбираются автоматически; автоматического бесконечного fallback нет.

## Autosave state

```text
IDLE / LOCAL
→ CREATING
→ CREATED
→ SAVING
→ SAVED
→ ERROR или CONFLICT
```

Флаг создания выставляется только в момент фактического POST, а не при постановке debounce. Одновременно выполняется не более одной mutation. Изменения во время POST сохраняются следующим последовательным PATCH с актуальной version. Пока mutation выполняется, второй PATCH не стартует. HTTP 409 переводит мастер в `CONFLICT`, останавливает autosave и не запускает автоматический retry.

## ПЭК-контекст

ПЭК identifiers остаются в form/session envelope для объяснения источника перехода и восстановления UX-контекста. Create/PATCH mapper их не отправляет и не сообщает о созданной серверной связи без ответа backend.

## Добавленные и обновлённые тесты

- роли `ADMIN`, `DIRECTOR`, `HEAD`, `LABORATORY`, `WASTE_SPECIALIST`;
- единый guard кнопки и прямых маршрутов;
- обязательные template + company, create payload и отсутствие company в PATCH;
- стабильный ключ после timeout/retry и новый ключ нового мастера;
- отсутствие генерации UUID внутри API operation;
- восстановление формы, шага, результата `0`, type-specific conditions и ключа;
- отсечение чужого пользователя и старой schemaVersion;
- fail-closed download roles и отсутствие `protocol.permissions`;
- различие query keys для `normLevel` и `visualWorkCategory`;
- ACTIVE/ALL режим, явное расширение и маркировка неактивного норматива;
- обновлены прежние contract tests, которые фиксировали старый ACTIVE-only поиск и запрет создания всем ролям.

## Фактические проверки

### TypeScript

```text
> npm run typecheck
> tsc --noEmit
Exit code: 0
```

### Lint

```text
> npm run lint
2 tests passed, 0 failed
Exit code: 0
```

### Tests

```text
Node test runner: 155 tests; 154 passed; 0 failed; 1 skipped
Vitest: 16 files passed; 227 tests passed
Exit code: 0
```

Единственный skip относится к отсутствующему в frontend workspace backend migration fixture и не является падением протоколов.

### Production build

```text
> npm run build
13790 modules transformed
Production MSW check passed
Production API base check passed
Prerendered 62 public pages
PASS SEO audit: 38 indexable pages, 0 non-blocking warnings
Exit code: 0
```

## Оставшиеся подтверждённые backend gaps

1. `ProtocolPermissions` не содержит отдельный `canDownload`. Frontend временно повторяет backend role guard download endpoints и работает fail-closed.
2. Backend DTO протокола не принимает прямые идентификаторы ПЭК. Frontend сохраняет контекст только для UX и не симулирует серверную связь.

