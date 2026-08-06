# Аудит frontend-контракта мастера протоколов

Дата аудита: 2026-08-05.

## Источник backend-контракта

- `GET http://localhost:4173/api/v3/api-docs` проверен повторно и возвращает `401` без авторизованной backend-сессии.
- `/v3/api-docs` на Vite dev server возвращает SPA `index.html`, а не OpenAPI.
- Java backend source в текущем workspace отсутствует.
- Доступный подтверждённый источник — проведённый ранее аудит Java-классов в `docs/protocol-backend-integration-report.md` (`ProtocolController`, `ProtocolApiDtos`, `ProtocolPermissionService`, result/document controllers).
- OpenAPI generator для основного CRM frontend не найден. `edo-app/openapi-ts.config.ts` относится к другому приложению и не применяется к CRM протоколов.

Новые endpoint и enum в рамках переработки не должны создаваться до появления авторизованного OpenAPI или актуального backend source.

## Текущий пользовательский путь

1. Список: `src/pages/ProtocolsPage.tsx` и `src/components/protocols/ProtocolList.tsx`.
2. Кнопка создания показывается по подтверждённому auth permission `create_protocols`.
3. Модальный мастер: `src/features/protocols/components/CreateProtocolWizardModal.tsx`.
4. Пять текущих шагов: основные данные; исполнитель/прибор; результаты; проверка; подписание.
5. До финальной отправки данные сохраняются только в user-scoped `sessionStorage`.
6. Финальная отправка вызывает `POST /api/protocols/quick-create`.
7. Старый финальный сценарий мог сразу после создания вызвать calculate, check normatives, download PDF, NCALayer и sign.

## Frontend-структура

- RHF form model: `components/wizardTypes.ts`.
- Локальная validation: `utils/protocolWizardValidation.ts` и проверки внутри modal.
- Quick-create boundary: `api/protocolContracts.ts`, `mappers/mapProtocolWizardToRequest.ts`, `services/apiProtocolService.ts`.
- PATCH boundary: `UpdateProtocolRequest` и `mapProtocolFormToPatchRequest`.
- Permissions: `utils/protocolPermissions.ts`, `mappers/protocolPermissionMapper.ts`, `utils/protocolActions.ts`.
- Normative search: `NormativeSelectorModal.tsx`, `useNormativeSearch.ts`, `normativeSearchService.ts`.
- Devices: `DeviceSelector.tsx`, `measurementDeviceService.ts`, `protocolDevices.ts`.
- Companies/objects: `companyService.ts`, `BasicDataStep.tsx`.
- Laboratories/employees: `laboratorySettingsService.ts`, `ExecutorDeviceStep.tsx`.
- Workflow/signing/preview: `protocolWorkflowApi.ts`, `useSignProtocolMutation.ts`, `ProtocolPreviewModal.tsx`.
- Query keys: `features/protocols/hooks/queryKeys.ts`, плюс несколько legacy ad-hoc keys.
- Tests: `tests/protocol-*.{ts,tsx,mjs}`.

## Подтверждённые HTTP operations

- `GET/POST /api/protocols`, `GET/PATCH/DELETE /api/protocols/{id}`;
- `POST /api/protocols/quick-create`;
- result CRUD и bulk-device/bulk-place/bulk-delete;
- `POST /api/protocols/{id}/ready-for-approval`;
- approve/return/sign/cancel/archive/corrections;
- `POST /api/protocols/{id}/check-normatives`;
- `GET /api/protocols/{id}/preview` и download PDF/DOCX;
- templates, normatives, devices, laboratories, employees, companies/objects.

Version передаётся в JSON body workflow/PATCH. `If-Match` для протоколов подтверждённым Java-контрактом не используется.

## Локальные DTO и расхождения

| Область | Frontend | Подтверждённый backend gap/различие |
|---|---|---|
| Создание | `CreateProtocolPayload`, quick-create request | два разных create-контракта; мастер использует quick-create вместо раннего server draft |
| PATCH | `UpdateProtocolRequest` | не содержит `conditions`, `orderServiceItemId` и ПЭК business links |
| Quick create | содержит conditions и measurements | подтверждённый DTO не сохраняет `orderServiceItemId` и ПЭК business links; `orderId` строковый |
| Статусы | frontend нормализует несколько исторических статусов | неизвестный статус закрывается в `UNKNOWN`, но часть legacy helpers всё ещё выводила разрешения из status/role |
| Actions | `availableActions[]` и `permissions` одновременно | legacy fallback из permissions дублировал backend actions |
| Validation | большая локальная проверка | отдельный `POST .../validate` в подтверждённом controller отсутствует; READY endpoint остаётся backend business validation |
| Type-specific enums | ряд полей — свободный текст | templates response не содержит enum options; OpenAPI enum сейчас недоступны |
| Draft | user-scoped sessionStorage | server draft не создаётся до полной quick-create отправки |

## Скрытые обязательные поля и UX-проблемы

- условия и методики находятся в закрытом `<details>` на первом шаге;
- локальная «Сохранить черновик» требует результаты, прибор, методику и все поля, то есть фактически не является сохранением черновика;
- кнопка сохранения доступна только на последнем шаге;
- финальная кнопка называется «Создать и подписать протокол»;
- NCALayer связан с созданием, хотя должен запускаться только отдельным действием существующего протокола;
- lighting не показывает `workplaceType`;
- season/workCategory/room/workplace/lighting/noise/normLevel/visualWorkCategory — свободный текст;
- результаты постоянно показываются большими карточками;
- нет централизованного structured field-error mapper с `step`/`rowIndex`;
- version conflict не имеет отдельного диалога сохранения локальной копии;
- список смешивает `availableActions` и legacy permission fallback;
- query keys списка не включают user/company scope;
- logout очищает document-flow cache, но не protocol cache.

## Удаляемые fallback-механизмы

- status/role-based entity actions в `protocolPermissions.ts`;
- fallback `availableActions -> permissions` в `protocolActions.ts`;
- создание+подписание внутри мастера;
- sessionStorage как основной draft storage;
- автоматический полностью ослабленный normative search;
- технические quick-create/DTO тексты в пользовательском UI.

## Backend blockers

1. Нужен доступный OpenAPI для окончательной сверки enum и required constraints.
2. Не подтверждён отдельный protocol validate endpoint и structured validation issue DTO.
3. PATCH DTO не подтверждает `conditions`, `orderServiceItemId` и ПЭК-связи; их нельзя безопасно восстановить после новой авторизации через выдуманные поля.
4. Templates/capabilities DTO не предоставляет подтверждённые options для всех type-specific справочников.
5. Отдельный create capability endpoint отсутствует; кнопка создания использует существующий auth permission `create_protocols`.
6. `GET /measurement-devices/available` текущего подтверждённого Java controller не принимает laboratory/date/type filters, поэтому frontend может фильтровать только реально возвращённые active/verification признаки.
