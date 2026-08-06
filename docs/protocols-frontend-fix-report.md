# Отчёт по исправлению frontend раздела «Протоколы»

Дата проверки: 06.08.2026.

## Источник контракта

Проверен backend из архива `eco-master (17).zip`: `ProtocolController`, `ProtocolCalculationController`, request/response DTO, enum статусов и объект `ProtocolResponse.permissions`. Контрактная матрица находится в `docs/protocols-frontend-contract-matrix.md`.

## Первоначальные причины проблем

- frontend смешивал backend permissions, локальные роли, статусы и `availableActions`;
- присутствовали отсутствующие на backend статусы `READY_TO_SIGN`, `UNDER_REVIEW`, `RETURNED_FOR_CORRECTION`;
- мастер создавал протокол через quick-create вместо раннего серверного DRAFT;
- `environment.conditions` не проходил полный путь response → form → PATCH;
- числовые значения среды отправлялись строками;
- локальные query keys протоколов не учитывали текущего пользователя;
- отдельные действия генерации и повторной генерации документов отображались как одно;
- тесты фиксировали устаревший контракт `orderServiceItemId`, permissions и top-level `conditions`.

## Реализованный пользовательский путь

1. Пользователь открывает список протоколов с серверной фильтрацией и пагинацией.
2. В мастере выбирает тип протокола. После минимально допустимых данных создаётся backend DRAFT через `POST /api/protocols/drafts` с `Idempotency-Key`.
3. Каждый следующий save использует `PATCH /api/protocols/{id}/draft` и актуальную `version`.
4. Ответ backend повторно преобразуется в форму без потери `0`, заказа, услуги заказа и type-specific условий.
5. Результаты добавляются и изменяются отдельными backend operations; массовые действия используют bulk endpoints.
6. Проверка нормативов, передача на утверждение, возврат, утверждение, подписание, исправление, отмена и архив выполняются отдельными действиями.
7. Preview и NCALayer запускаются только в сценарии явного подписания; статус меняется только после ответа backend.
8. Генерация, повторная генерация и скачивание DOCX/PDF разделены в интерфейсе.

## Состояния пяти шагов мастера

- **Основные сведения:** тип, компания, объект, дата, место, связь с заказом и услугой заказа.
- **Условия:** лаборатория, исполнитель, прибор, числовые параметры среды и `environment.conditions` (`workplaceType`, `factorType`, параметры воды и остальные type-specific значения).
- **Показатели и результаты:** нормативный поиск, компактные строки результатов, массовое применение прибора и места, сохранение значения `0`.
- **Проверка:** backend field errors переводятся в соответствующий шаг и поле; ошибки строк учитывают индекс.
- **Завершение:** сводка и сохранённый серверный DRAFT. Создание не запускает подписание автоматически.

## Основные изменённые файлы

- `src/features/protocols/api/protocolContracts.ts`
- `src/features/protocols/api/protocolMappers.ts`
- `src/features/protocols/api/protocolApi.ts`
- `src/features/protocols/api/protocolDraftApi.ts`
- `src/features/protocols/api/saveProtocolWizardDraft.ts`
- `src/features/protocols/components/CreateProtocolWizardModalV2.tsx`
- `src/features/protocols/mappers/protocolWizardDraftMapper.ts`
- `src/features/protocols/mappers/mapFormToCreateProtocolRequest.ts`
- `src/features/protocols/mappers/protocolPermissionMapper.ts`
- `src/features/protocols/hooks/queryKeys.ts`
- `src/features/protocols/hooks/useSignProtocolMutation.ts`
- `src/features/protocols/details/ProtocolActionsMenu.tsx`
- `src/features/protocols/details/ProtocolDocumentsTab.tsx`
- `src/pages/ProtocolsPage.tsx`
- `src/pages/ProtocolEditorPage.tsx`
- `src/components/protocols/ProtocolResultsTable.tsx`
- `src/services/apiProtocolService.ts`
- `src/services/protocolService.ts`
- `src/services/normativeSearchService.ts`
- `src/types/protocols.ts`
- `src/utils/protocolPermissions.ts`
- `src/config/protocolStatus.ts`
- protocol tests in `tests/`

## Permissions и статусы

Entity actions разрешаются только literal `true` из 16 фактических полей `ProtocolResponse.permissions`. Локальные role/status fallbacks и протокольный `availableActions` удалены. Неизвестный статус нормализуется в `UNKNOWN` и блокирует все mutation actions, сохраняя только разрешённый backend просмотр.

Поддерживаемые статусы: `DRAFT`, `CALCULATED`, legacy `READY`, `READY_FOR_APPROVAL`, `NEEDS_REVISION`, `APPROVED`, `SIGNED`, `REPLACED`, `CANCELLED`, `ARCHIVED`.

## Ошибки и optimistic locking

- `fieldErrors`, `code`, HTTP status и `traceId` сохраняются общим API error normalizer;
- 409 не приводит к автоматической перезаписи: пользователь может загрузить актуальную версию;
- endpoints с `VersionRequest` и `UpdateProtocolRequest` передают version в JSON body, DELETE — query parameter;
- для действий, где backend не принимает version, frontend выполняет предварительный GET и сравнение версии. Это снижает риск, но не является атомарной backend-блокировкой.

## Query cache

Ключи списка, деталей, результатов, истории, документов и подписей имеют scope `backend-resolved:<currentUserId>`. После mutations инвалидируются связанные ключи текущего пользователя, а не общий кэш всех пользователей.

## Фактические проверки

- `npm run typecheck` — успешно, exit code 0.
- `npm run lint` — успешно: 2/2 проверки.
- `npm run test` — успешно, exit code 0:
  - Node test: 155, passed 154, skipped 1, failed 0;
  - Vitest: 15 файлов, 201 тест, failed 0.
- `npm run build` — успешно, exit code 0:
  - TypeScript и Vite build прошли;
  - 13 788 модулей преобразовано;
  - production MSW/API-base checks прошли;
  - prerender: 62 страницы;
  - SEO audit: PASS, 0 warnings.

Для стабильности тестов в текущем Windows-окружении Vitest запускается с `--maxWorkers=1`.

## Подтверждённые backend gaps

1. Request DTO создания/обновления протокола поддерживает `orderId` и `orderServiceItemId`, но не принимает поля связи ПЭК (`pekProgramId`, `pekReportId`, `pekControlItemId`, `pekControlEventId`, `monitoringPointId`, `emissionSourceId`, `waterOutletId`). Эти поля есть только в response. Frontend не отправляет выдуманный payload, поэтому сквозное создание связи из ПЭК требует backend endpoint/DTO.
2. `/sign` принимает только `cmsSignatureBase64`; version в DTO отсутствует.
3. calculate, generate documents, raw-measurement save/import и некоторые refresh operations не принимают version. Полностью атомарный optimistic locking для них невозможно реализовать только на frontend.
4. В `ProtocolResponse.permissions` нет отдельного `canDownload`; download endpoints защищены общей backend security. Frontend не может различить просмотр и скачивание отдельным entity permission.
5. Result endpoints используют слабо типизированные map payload/response вместо отдельных DTO.

## Не выполненная проверка

Live E2E с реально запущенным backend, базой данных, NCALayer и сертификатом не запускался. Unit/integration и production build прошли, но сценарий реальной подписи должен быть подтверждён в тестовом окружении с backend и NCALayer. Связь с ПЭК невозможно подтвердить до устранения backend gap №1.
