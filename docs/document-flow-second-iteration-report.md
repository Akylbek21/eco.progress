# Document Flow: отчёт второй итерации

Дата проверки: 03.08.2026. Источник backend: `.backend-eco8/eco-master/src/main/java/kz/ecoprogress/documentflow`.

## Исправления

| Проблема | Frontend-файл | Backend-источник | Исправление | Тест |
|---|---|---|---|---|
| cache key с неопределённым tenant | `documentFlowKeys.ts`, `useDocumentFlowTenant.ts` | `OrganizationResolver` | explicit `backend-resolved:<userId>`, queries disabled без user | typecheck/focused |
| частичное создание дублировало стадии после reload | `creationCheckpoint.ts`, `CreateDocumentPage.tsx` | create idempotency + route GET | persisted state machine, state reconciliation | 7 parametrized failure cases |
| PATCH считался сохранённым без reread | те же | `UpdateDocumentRequest`, `DocumentController.patch` | PATCH, затем GET и compare number | exact payload test |
| signing placeholders показывались как 0/false | `types.ts`, `documentFlowApi.ts`, `DocumentsPage.tsx` | `DocumentDtos` и `DocumentService` TODO constants | boundary removes placeholders; UI «Нет данных» | contract/focused |
| скрытый internal sign выбирал активное assignment без backend action | `DocumentDetailsPage.tsx`, `documentActions.ts` | `availableActions()` | submit/NCALayer fallback удалён; contract blocker | action resolver test |
| public DTO содержал придуманные optional fields | `types.ts`, `contractSchemas.ts` | `PublicInvitationView` | поля удалены; fake sign button удалена | strict schema |
| public 401 мог считаться private auth failure | `api.ts` | public controller is anonymous | JWT/logout/redirect bypass | session preservation test |
| поиск контрагентов фильтровал только текущие 20 | `CounterpartiesPage.tsx` | controller accepts page/size only | локальный search удалён; показан backend gap | source audit |
| DTO принимались без runtime проверки | `contractSchemas.ts`, `documentFlowApi.ts` | Java records | strict Zod boundary for critical DTO | contract test |

## API участников

`DocumentFlowMemberController` в доступном snapshot не найден ни по имени, ни по mapping/method. Есть `DocumentFlowMembership`, enum role/status и `DocumentFlowMembershipRepository`, но нет HTTP controller/service/DTO. Поэтому `getMembers/addMember/updateMemberRole/activate/deactivate` не добавлялись: это создало бы выдуманный endpoint.

Signing route принимает `userId`. Member picker остаётся заблокирован: backend также не проверяет в `SigningRouteService.buildSteps`, что переданный internal `userId` принадлежит организации и имеет `SIGN_DOCUMENT`.

## Организация

`/access` выбирает первую non-REMOVED membership, но `AccessContextDto` не возвращает organization ID. Для одного tenant backend endpoints безопасно разрешают membership при отсутствующем ID. Frontend поэтому не отправляет fake ID и использует cache scope `backend-resolved:<currentUserId>`. Для multi-org `OrganizationResolver` требует ID, который frontend получить не может; selector не создан.

## Создание

| Stage | Endpoint | Idempotency/reconcile | Checkpoint retry |
|---|---|---|---|
| DOCUMENT_CREATED | POST `/documents` | stable backend `Idempotency-Key` | same key |
| REQUISITES_UPDATED | PATCH + GET `/documents/{id}` | compare saved number | same document |
| MAIN_FILE_UPLOADED | POST `/file` + GET detail | `currentVersionId` reconcile | no repeat after ambiguous response |
| ATTACHMENTS_UPLOADED | POST/GET attachments | id/name/size reconcile | only missing attachment |
| ROUTE_CREATED | GET then POST route | existing route wins | no duplicate route |
| PREPARED | POST prepare | backend method is idempotent/reservation guarded | same route |
| SENT | GET route then POST send | ACTIVE/COMPLETED skips send | no false 409 failure |
| COMPLETED | local | checkpoint removed after navigation | complete |

Checkpoint stores IDs, stage, version, operation key and timestamps only. File bytes, CMS, token, PIN and certificate are not stored.

## Подтверждённые backend gaps

- member controller/DTO/routes absent;
- access DTO has no organization ID/list; multi-org cannot be selected;
- signerId/requiresMySignature accepted but not used in predicates;
- signing counters and requiresMySignature are hard-coded 0/0/false;
- availableActions never contains SIGN/REJECT/RETURN/REVOCATION/AUDIT;
- no current-assignment endpoint and `/signing-data` is only `SigningRouteResponse`;
- no signing challenge/dataToSign endpoint;
- public invitation lacks assignmentId/versionId although sign request requires them;
- counterparty list accepts only organizationId/page/size;
- archive action can be returned but archive endpoint is absent;
- audit service exists but read controller is absent;
- attachment download endpoint is absent;
- route creation does not validate an internal signer against organization membership/sign permission.

## Не подтверждено без runtime

- production DB contents/migrations and real membership cardinality;
- proxy/security behavior outside the supplied Java code;
- NCALayer compatibility with the backend CMS verifier;
- real SMTP invitation delivery;
- production response examples/trace IDs.

## Статус готовности

- Frontend готов: list/detail/create draft/PATCH/files/versions/attachments/counterparties pagination/public view+file+reject/dashboard.
- Frontend готов, интеграция заблокирована backend: member picker, multi-org selector, internal/public signing, signer filters/counters, archive, audit.
- Frontend не готов: полноценный browser E2E с живым backend/DB/NCALayer не выполнен в локальном snapshot.

## Фактические проверки

- `npm run typecheck` — passed.
- `npm run lint` — passed, 2/2.
- `npx vitest run tests/document-flow.test.tsx` — passed, 33/33.
- `npm run test` — passed: Node 155/155; Vitest 162/162, 13/13 files.
- `npm run build` — passed: TypeScript, Vite (13 766 modules), production-no-MSW (125 assets), prerender (62 pages), SEO audit (38 indexable, 0 warnings).
- OpenAPI generation — not run: no script and no OpenAPI file exist in the supplied project/backend snapshot.
