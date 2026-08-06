# Отчёт о переработке мастера протоколов

Дата: 2026-08-05.

## Результат

Рабочий маршрут создания переведён на `CreateProtocolWizardModalV2`. Мастер создаёт реальный `DRAFT` через `POST /api/protocols` после выбора типа, компании и объекта, получает `id/version`, а дальнейшие изменения сохраняет через подтверждённые `PATCH /api/protocols/{id}` и result endpoints. `sessionStorage` используется только как аварийный user-scoped буфер.

Создание, проверка, preview и подписание разделены. Мастер не запускает NCALayer. В редакторе NCALayer доступен только после явного подтверждения в preview. Действия над существующим протоколом fail-closed и определяются `availableActions`/backend permissions, без role/status fallback.

## Новый пользовательский путь

1. **Основные сведения** — тип, компания, объект, контекст заказа/ПЭК, дата и место. После минимального набора создаётся серверный черновик и показываются его номер и версия.
2. **Условия** — лаборатория, исполнитель, прибор, методика, среда и относящиеся к типу поля. Обязательные поля не спрятаны в `details`.
3. **Показатели и результаты** — явный ACTIVE-поиск нормативов, ручное добавление, компактная desktop-таблица, mobile-карточки, массовое применение прибора/методики/места/даты, дублирование и удаление.
4. **Проверка** — локальные обязательные проверки и подтверждённый `check-normatives` только при наличии соответствующего `availableAction`; ошибки ведут к шагу и RHF-полю.
5. **Завершение** — сводка и сохранение созданного серверного черновика. Подписание не запускается.

Состояния сохранения: «Сохраняем…», «Изменения сохранены», «Не удалось сохранить» и повторная отправка. При `PROTOCOL_VERSION_CONFLICT` данные не перезаписываются: пользователь выбирает загрузку актуальной версии либо сохранение локальной копии.

## Подтверждённые HTTP operations

- `POST /api/protocols` — раннее создание DRAFT.
- `PATCH /api/protocols/{id}` — сохранение заголовка с `version` в JSON.
- `GET /api/protocols/{id}` — актуальная версия после mutations и восстановление черновика.
- `POST/PATCH/DELETE /api/protocols/{id}/results[/resultId]` — строки результатов.
- `POST /api/protocols/{id}/check-normatives` — только если действие разрешено backend.
- `GET /api/normatives/search` — один запрос с явным статусом; ослабление фильтров пользователь запускает вручную.
- `GET /api/protocols/{id}/preview` — preview перед подписью.
- `POST /api/protocols/{id}/sign` — CMS после явного действия пользователя.

Новые endpoint, mock transport и DTO не добавлялись.

## Типы и mapping

- Единственная write-boundary для мастера: `protocolWizardDraftMapper.ts` → существующие `CreateProtocolPayload`, `UpdateProtocolPayload`, `ProtocolResultPayload`.
- `factorType`, `workplaceType`, type-specific conditions и результат `0` сохраняются в result `values`.
- `samplingDate` хранится на уровне строки и проходит в request.
- Физические `factorType` ограничены подтверждёнными значениями `ProtocolSubtype`.
- Неизвестный backend status нормализуется в `UNKNOWN`, отображается как «Неизвестный статус» и не разрешает mutations.

## Ошибки

`mapProtocolApiErrorsToForm()` централизованно:

- принимает массив `fieldErrors` или map;
- переводит `conditions.*`, `measurements.*`, `rowIndex` в RHF paths;
- определяет шаг;
- вызывает `setError`, `setFocus` и scroll;
- заменяет технические DTO/schema/enum сообщения понятным текстом.

Конфликт версии не вызывает автоматическую перезапись. После успешного update версия берётся только из ответа сервера.

## Изменённые frontend-файлы

Основные:

- `src/pages/ProtocolsPage.tsx`
- `src/pages/ProtocolEditorPage.tsx`
- `src/components/protocols/ProtocolList.tsx`
- `src/components/protocols/ProtocolPreviewModal.tsx`
- `src/features/protocols/components/CreateProtocolWizardModalV2.tsx`
- `src/features/protocols/components/ProtocolWizardFooter.tsx`
- `src/features/protocols/components/components/ProtocolResultTable.tsx`
- `src/features/protocols/components/components/NormativeSelectorModal.tsx`
- `src/features/protocols/components/steps/BasicDataStep.tsx`
- `src/features/protocols/components/steps/EnvironmentStep.tsx`
- `src/features/protocols/components/steps/MethodsStep.tsx`
- `src/features/protocols/components/steps/ProtocolSigningStep.tsx`
- `src/features/protocols/api/saveProtocolWizardDraft.ts`
- `src/features/protocols/mappers/protocolWizardDraftMapper.ts`
- `src/features/protocols/utils/protocolFormErrors.ts`
- `src/features/protocols/utils/protocolActions.ts`
- `src/features/protocols/utils/protocolWizardValidation.ts`
- `src/features/protocols/hooks/useSignProtocolMutation.ts`
- `src/services/normativeSearchService.ts`
- `src/utils/protocolPermissions.ts`
- `src/contexts/AuthContext.tsx`

Тесты и документация:

- `tests/protocol-wizard-v2.test.ts`
- `tests/protocol-overhaul.test.ts`
- `tests/protocol-details.test.ts`
- `tests/protocol-signatures.test.tsx`
- `tests/protocol-quick-create.test.tsx`
- `tests/normative-search-api.test.tsx`
- `tests/protocol-wizard.test.mjs`
- `tests/normative-search.test.mjs`
- `docs/protocol-frontend-contract-audit.md`
- `docs/protocol-frontend-implementation-report.md`

## Проверки

- `npm run typecheck`: **PASS**, exit code 0.
- Protocol-focused run: **37/37 PASS**.
- Полный Vitest-набор из package script: **181/181 PASS**, 15 files.
- Node static/contract tests: **154/155 PASS**. Единственный fail не относится к протоколам: отсутствует `backend/src/main/resources/db/migration/V5__create_content_management.sql`, который ожидает `tests/content-management.test.mjs`.
- `npm run build`: **PASS**, exit code 0. Vite собрал 13 783 модуля; production MSW/API-base checks, prerender 62 страниц и SEO audit прошли.
- Браузерные screenshots не сняты: OpenAPI/local backend требует авторизованную сессию, а browser runtime в текущем окружении недоступен. Состояния пяти шагов описаны выше; build подтверждает их production-компиляцию.

## Оставшиеся backend gaps

1. Авторизованный OpenAPI недоступен из текущего workspace: `/api/v3/api-docs` возвращает `401`, Java backend source отсутствует.
2. Подтверждённый `CreateProtocolRequest`/`UpdateProtocolRequest` не содержит `orderServiceItemId` и полного ПЭК-контекста. Frontend сохраняет контекст в форме/аварийном буфере, но намеренно не отправляет выдуманные поля. Для восстановления этих связей после новой авторизации backend должен расширить DTO и GET response либо предоставить подтверждённый link endpoint.
3. Отдельный validate endpoint с группированными issues не подтверждён. Используются локальная проверка и существующий `check-normatives`; серверный validate не имитируется.
4. Backend templates не возвращают централизованные enum directories для всех `season/workCategory/roomType/workplaceType/lightingType/noiseType/visualWorkCategory/normLevel`. Свободные значения нельзя безопасно заменить выдуманными enum до расширения контракта.
5. Подтверждённый device endpoint не принимает весь запрошенный набор lab/type/date/calibration filters. Frontend передаёт только поддерживаемые параметры и не подменяет backend eligibility.
6. Полный E2E с реальной повторной авторизацией, заказом, ПЭК и NCALayer требует доступного backend/test account и browser runtime. Эти сценарии не отмечены как пройденные.

Из-за пунктов 2–6 все критерии, зависящие от отсутствующего backend-контракта или реального E2E, остаются открытыми; frontend не маскирует их фиктивным успехом.
