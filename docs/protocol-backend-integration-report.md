# Интеграция «Протоколы лабораторных исследований»

Дата проверки: 31.07.2026.

## Источник контракта

В каталоге загрузок отсутствует файл `eco-master (8)(1).zip`. Из доступных архивов использован самый новый `eco-master (8).zip` от 31.07.2026 09:26.

Проверены Java-классы:

- `ProtocolController`;
- `ProtocolResultController`;
- `ProtocolCalculationController`;
- `ProtocolApiDtos`;
- `ProtocolDtos`;
- `ProtocolStatus`;
- `ProtocolPermissionService`;
- `ProtocolMutationGuard`;
- `ProtocolCalculationService`;
- `ProtocolDocumentGenerationService`;
- `ProtocolNormativeCheckService`;
- дополнительно `NormativeReferenceController`, `MeasurementDeviceController` и DTO приборов.

Живой OpenAPI подтвердить не удалось: `/v3/api-docs` на известном backend ранее отвечал `404`, `/api/v3/api-docs` — `401` без сессии, а во время итоговой проверки backend по адресу окружения не принимал соединение. Поэтому реализация сверена с Java-кодом архива; различия Java/OpenAPI нельзя достоверно зафиксировать без авторизованного доступного экземпляра.

## Используемые endpoints

### Протоколы и шаблоны

- `GET /api/protocols/templates`
- `GET /api/protocols`
- `GET /api/protocols/{id}`
- `POST /api/protocols`
- `POST /api/protocols/quick-create`
- `PATCH /api/protocols/{id}`
- `DELETE /api/protocols/{id}`
- `GET /api/protocols/{id}/audit`

### Workflow

- `POST /api/protocols/{id}/ready-for-approval`
- `POST /api/protocols/{id}/return-for-revision`
- `POST /api/protocols/{id}/approve`
- `POST /api/protocols/{id}/sign`
- `POST /api/protocols/{id}/corrections`
- `POST /api/protocols/{id}/cancel`
- `POST /api/protocols/{id}/archive`
- `POST /api/protocols/{id}/publish-to-client`

Version для workflow передаётся в JSON body. `If-Match` для протоколов не используется.

### Результаты

- `POST /api/protocols/{id}/results`
- `PATCH /api/protocols/{id}/results/{resultId}`
- `DELETE /api/protocols/{id}/results/{resultId}`
- `PATCH /api/protocols/{id}/results/bulk-device`
- `PATCH /api/protocols/{id}/results/bulk-place`
- `DELETE /api/protocols/{id}/results/bulk`

### Измерения и расчёты

- `GET /api/protocols/method-templates`
- `GET /api/protocols/method-templates/{id}`
- `GET /api/protocols/{protocolId}/results/{resultId}/raw-measurements`
- `POST /api/protocols/{protocolId}/results/{resultId}/raw-measurements`
- `POST /api/protocols/{protocolId}/results/{resultId}/calculate`
- `POST /api/protocols/{protocolId}/calculate`
- `GET /api/protocols/{protocolId}/results/{resultId}/calculation-history`

### Нормативы

- `GET /api/normatives/search`
- `POST /api/protocols/{id}/check-normatives`

### Приборы

- `GET /api/measurement-devices`
- `GET /api/measurement-devices/available`
- `POST /api/protocols/{id}/measurement-devices`
- `DELETE /api/protocols/{id}/measurement-devices/{deviceId}?version=...`

### Документы

- `GET /api/protocols/{id}/preview`
- `POST /api/protocols/{id}/generate-docx`
- `POST /api/protocols/{id}/generate-pdf`
- `GET /api/protocols/{id}/download-docx`
- `GET /api/protocols/{id}/download-pdf`

Скачивание и preview выполняются авторизованным Axios-клиентом; Blob URL preview освобождается.

### Интеграция ПЭК

- `POST /api/pek/reports/{reportId}/collect`

`pekReportId` используется только как navigation context. После финализации протокола повторный сбор выполняется backend; связь не записывается в localStorage и не создаётся frontend-кодом.

## Основные изменения

- Статусы синхронизированы с `ProtocolStatus`; неизвестный статус переводит UI в read-only и логируется.
- Permissions нормализуются в одном mapper. Алиасы `canReadyForApproval` и `canReplace` выводятся только из `canSendToApproval` и `canCreateCorrection`.
- Удалён общий interceptor, который ошибочно удалял protocol `version` из body и формировал `If-Match`.
- Quick-create и full create имеют отдельные mapper-функции и разные DTO.
- Quick-create conditions сериализуются строками без потери `0`.
- `measurementDeviceId` является основным полем; `deviceId` оставлен только как read/write fallback контракта.
- Неизвестные поддерживаемые значения строки сохраняются в `values`; `clientRowId` в API не отправляется.
- При выбранном `normativeId` frontend не подменяет официальный норматив пользовательским `normativeValue`.
- Результаты, bulk-операции, raw measurements, расчёты и нормативная проверка разделены.
- Preview, генерация и скачивание DOCX/PDF представлены отдельными действиями.
- Подписание сначала загружает свежий протокол, проверяет permission/PDF, затем подключает NCALayer и отправляет только CMS.
- Список получил полный URL-backed набор backend-фильтров и отдельное мобильное карточное представление.
- Audit загружается отдельным актуальным endpoint.
- Добавлены тематические API-модули queries/commands/workflow/results/documents/calculation/normatives/signing.

## Удалённый или отключённый legacy

- удалён `src/features/protocols/api/protocolLegacyReadAdapter.ts`;
- удалены protocol-статусы `RETURNED_FOR_REVISION` и `PUBLISHED`;
- новый UI не вызывает `/api/protocol-results/{resultId}`;
- новый UI не вызывает `/replace` и `/return-to-draft`;
- скачивание использует только `/download-docx` и `/download-pdf`;
- из protocol PATCH удалены неподдерживаемые `application`, `conditions`, `orderServiceItemId`;
- из quick-create удалены `environment`, PEK business-link поля и числовой `orderId`;
- удалено локальное повышение `version` и локальная установка workflow-статусов.

## Изменённые файлы

### API, типы и mappers

- `src/services/api.ts`
- `src/services/apiProtocolService.ts`
- `src/services/protocolService.ts`
- `src/services/measurementDeviceService.ts`
- `src/types/protocols.ts`
- `src/config/protocolStatus.ts`
- `src/utils/protocolPermissions.ts`
- `src/features/protocols/api/protocolContracts.ts`
- `src/features/protocols/api/protocolMappers.ts`
- `src/features/protocols/api/protocolQueries.ts`
- `src/features/protocols/api/protocolCommands.ts`
- `src/features/protocols/api/protocolWorkflowApi.ts`
- `src/features/protocols/api/protocolResultsApi.ts`
- `src/features/protocols/api/protocolDocumentsApi.ts`
- `src/features/protocols/api/protocolCalculationApi.ts`
- `src/features/protocols/api/protocolNormativesApi.ts`
- `src/features/protocols/api/protocolSigningApi.ts`
- `src/features/protocols/mappers/mapProtocolWizardToRequest.ts`
- `src/features/protocols/mappers/mapFormToCreateProtocolRequest.ts`
- `src/features/protocols/mappers/protocolPermissionMapper.ts`
- удалён `src/features/protocols/api/protocolLegacyReadAdapter.ts`

### UI

- `src/pages/ProtocolsPage.tsx`
- `src/pages/ProtocolEditorPage.tsx`
- `src/components/protocols/ProtocolList.tsx`
- `src/components/protocols/ProtocolGeneralForm.tsx`
- `src/components/protocols/ProtocolResultsTable.tsx`
- `src/features/protocols/details/ProtocolActionsMenu.tsx`
- `src/features/protocols/details/ProtocolDetailsView.tsx`
- `src/features/protocols/details/ProtocolDocumentsTab.tsx`
- `src/features/protocols/details/ProtocolHeader.tsx`
- `src/features/protocols/details/ProtocolNextStepCard.tsx`
- `src/features/protocols/details/protocolDetailsModel.ts`
- `src/features/protocols/hooks/useSignProtocolMutation.ts`
- `src/features/protocols/utils/quickCreateError.ts`

### Тесты и scripts

- `package.json`
- `tests/backend-contract-regressions.test.mjs`
- `tests/normative-search.test.mjs`
- `tests/protocol-backend-authority.test.mjs`
- `tests/protocol-current-backend.test.ts`
- `tests/protocol-domain.test.ts`
- `tests/protocol-overhaul.test.ts`
- `tests/protocol-quick-create.test.tsx`
- `tests/protocol-signatures.test.tsx`
- `tests/protocol-water.test.tsx`
- `tests/protocol-wizard.test.mjs`

Изменения ПЭК, уже находившиеся в рабочем дереве до этой синхронизации, в этот список не включены.

## Backend/OpenAPI ограничения и расхождения

1. Файл с точным именем `eco-master (8)(1).zip` отсутствовал; использован последний доступный `(8)`.
2. Живой OpenAPI не был доступен без авторизованной работающей backend-сессии, поэтому его расхождение с Java не проверено.
3. `GET /measurement-devices/available` в текущем Java controller не принимает параметры лаборатории, даты или типа измерения, а DTO ответа не содержит все эти признаки. Frontend не отправляет несуществующие query parameters и проверяет только реально возвращённые активность, статус и срок поверки.
4. Result mutation endpoints возвращают DTO строки/списка, а не полный `ProtocolResponse` с гарантированно свежим aggregate version. После мутации frontend перечитывает протокол.
5. Raw measurement и calculation endpoints текущего Java-кода не принимают optimistic-lock version. Frontend не добавляет несуществующий body.
6. Backend сохраняет legacy aliases (`/replace`, `/return-to-draft`, `/download/docx`, `/download/pdf`) и отдельный `ProtocolResultController`; новый frontend использует только канонические endpoints.
7. В backend одновременно существуют старые `ProtocolDtos` и актуальные `ProtocolApiDtos`; `ProtocolController` использует актуальные `ProtocolApiDtos`.

## Проверки

- `npm run typecheck` — успешно.
- `npm run lint` — успешно, 2/2.
- `npm test` — успешно:
  - Node contract/static tests: 155/155;
  - Vitest unit/component tests: 119/119, 12/12 файлов.
- `npm run build` — успешно:
  - TypeScript и Vite production build;
  - production-no-MSW check;
  - prerender;
  - SEO audit.

Полный E2E со сменой реальных backend-статусов, NCALayer и публикацией не запускался: доступного авторизованного backend/NCALayer стенда в окружении нет. Эти внешние проверки не подменялись mock-результатом в production-коде.
