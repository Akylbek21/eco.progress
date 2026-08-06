# Контрактная матрица frontend протоколов

Источник: backend `eco-master (17).zip`, проверен 06.08.2026. Базовый контроллер — `/api/protocols`. Ответы JSON обёрнуты в `ApiResponse<T>`.

| Frontend action | Method | Endpoint | Request DTO / version | Response DTO | Permission | Status |
|---|---|---|---|---|---|---|
| Список | GET | `/api/protocols` | server filters, page, size, sort | `PageResponse<ProtocolListItemDto>` | `PROTOCOL_VIEW` | Проверен |
| Детали | GET | `/api/protocols/{id}` | — | `ProtocolResponse` | `PROTOCOL_VIEW` | Проверен |
| Шаблоны | GET | `/api/protocols/templates` | — | `List<ProtocolTemplateResponse>` | `LAB_PROTOCOL` | Проверен |
| Создать черновик | POST | `/api/protocols/drafts` | `CreateProtocolDraftRequest`; optional `Idempotency-Key` | `ProtocolResponse` | `LAB_PROTOCOL` | Интегрирован |
| Обновить черновик | PATCH | `/api/protocols/{id}/draft` | `UpdateProtocolRequest`, `version` в body | `ProtocolResponse` | `LAB_PROTOCOL` | Интегрирован |
| Полное создание | POST | `/api/protocols` | `CreateProtocolRequest` | `ProtocolResponse` | `LAB_PROTOCOL` | Проверен, не для пустого draft |
| Quick create | POST | `/api/protocols/quick-create` | `QuickCreateProtocolRequest`; optional `Idempotency-Key` | `ProtocolResponse` | `LAB_PROTOCOL` | Проверен |
| Обновить | PATCH | `/api/protocols/{id}` | `UpdateProtocolRequest`, `version` в body | `ProtocolResponse` | `LAB_PROTOCOL` | Проверен |
| Удалить | DELETE | `/api/protocols/{id}` | query `version` | `Void` | `LAB_PROTOCOL` | Проверен |
| История | GET | `/api/protocols/{id}/audit` | — | `List<HistoryItem>` | `PROTOCOL_VIEW` | Проверен |
| Добавить результат | POST | `/api/protocols/{id}/results` | map payload, `version` | result map | `LAB_PROTOCOL` | Проверен |
| Изменить результат | PATCH | `/api/protocols/{id}/results/{resultId}` | map payload, `version` | result map | `LAB_PROTOCOL` | Проверен |
| Удалить результат | DELETE | `/api/protocols/{id}/results/{resultId}` | query `version` | `ProtocolResponse` | `LAB_PROTOCOL` | Проверен |
| Массовый прибор | PATCH | `/api/protocols/{id}/results/bulk-device` | `BulkDeviceUpdateRequest` | `ProtocolResponse` | `LAB_PROTOCOL` | Проверен |
| Массовое место | PATCH | `/api/protocols/{id}/results/bulk-place` | `BulkPlaceUpdateRequest` | `ProtocolResponse` | `LAB_PROTOCOL` | Проверен |
| Массовое удаление | DELETE | `/api/protocols/{id}/results/bulk` | `BulkDeleteResultsRequest` | `ProtocolResponse` | `LAB_PROTOCOL` | Проверен |
| Рассчитать строку | POST | `/api/protocols/{id}/results/{resultId}/calculate` | backend не принимает version | `CalculationResultResponse` | `LAB_PROTOCOL` | Проверен |
| Рассчитать протокол | POST | `/api/protocols/{id}/calculate` | backend не принимает version | `ProtocolCalculationSummaryResponse` | `LAB_PROTOCOL` | Проверен |
| Проверить нормативы | POST | `/api/protocols/{id}/check-normatives` | `VersionRequest` | `ProtocolResponse` | `LAB_PROTOCOL` | Проверен |
| Передать на утверждение | POST | `/api/protocols/{id}/ready-for-approval` | `VersionRequest` | `ProtocolResponse` | `LAB_PROTOCOL` | Проверен |
| Вернуть на доработку | POST | `/api/protocols/{id}/return-for-revision` | `{ version, reason }` | `ProtocolResponse` | `PROTOCOL_SUPERVISOR` | Проверен |
| Утвердить | POST | `/api/protocols/{id}/approve` | `VersionRequest` | `ProtocolResponse` | `PROTOCOL_SUPERVISOR` | Проверен |
| Подписать | POST | `/api/protocols/{id}/sign` | `{ cmsSignatureBase64 }`; version отсутствует в DTO | `ProtocolResponse` | `PROTOCOL_SUPERVISOR` | Проверен |
| Исправленная версия | POST | `/api/protocols/{id}/corrections` | `{ reason, version }` | `ProtocolResponse` | `PROTOCOL_SUPERVISOR` | Проверен |
| Отменить | POST | `/api/protocols/{id}/cancel` | `{ reason, version }` | `ProtocolResponse` | `PROTOCOL_SUPERVISOR` | Проверен |
| Архивировать | POST | `/api/protocols/{id}/archive` | `VersionRequest` | `ProtocolResponse` | `PROTOCOL_SUPERVISOR` | Проверен |
| Опубликовать клиенту | POST | `/api/protocols/{id}/publish-to-client` | `PublishToClientRequest(version)` | `ProtocolResponse` | `PROTOCOL_SUPERVISOR` | Проверен |
| Preview | GET | `/api/protocols/{id}/preview` | — | PDF blob | `LAB_PROTOCOL` | Проверен |
| Сгенерировать DOCX/PDF | POST | `/api/protocols/{id}/generate-docx`, `/generate-pdf` | backend не принимает version | `ProtocolResponse` | `LAB_PROTOCOL` | Проверен |
| Скачать DOCX/PDF | GET | `/api/protocols/{id}/download-docx`, `/download-pdf` | — | blob + `Content-Disposition` | `LAB_PROTOCOL` | Проверен |
| Поиск нормативов | GET | `/api/normatives/search` | подтверждённые query filters; default `status=ACTIVE` | map search response | `LAB_PROTOCOL` | Проверен |

## Backend permissions

`ProtocolResponse.permissions` содержит только: `canView`, `canEdit`, `canDelete`, `canCalculate`, `canCheckNormatives`, `canGeneratePreview`, `canSendToApproval`, `canReturnForRevision`, `canApprove`, `canSign`, `canCreateCorrection`, `canCancel`, `canArchive`, `canPublish`, `canGenerateDocuments`, `canRegenerateDocuments`.

Frontend не должен выводить entity actions из роли или статуса и не должен использовать `availableActions` для протоколов.

## Статусы

Точный enum: `DRAFT`, `CALCULATED`, `READY` (legacy), `READY_FOR_APPROVAL`, `NEEDS_REVISION`, `APPROVED`, `SIGNED`, `REPLACED`, `CANCELLED`, `ARCHIVED`.
