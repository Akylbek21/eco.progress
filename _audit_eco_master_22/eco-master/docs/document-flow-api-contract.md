# Document Flow API contract

Все JSON-операции возвращают `ApiResponse<T>`: `success`, `data`, `message`; ошибки также содержат `code`, `fieldErrors`, `traceId` при наличии.

## Основной workflow

```text
DRAFT -> PREPARED_FOR_SIGNING -> SENT_FOR_SIGNING
      -> PARTIALLY_SIGNED -> SIGNED -> ARCHIVED
```

- `GET /api/document-flow/documents` — paged list; каждый элемент содержит `id`, `number`, `title`, `status`, `createdAt`, `updatedAt`, `version`.
- `POST /api/document-flow/documents/{id}/prepare-for-signing` — `{ "expectedVersion": 3 }`.
- `POST /api/document-flow/documents/{id}/send-for-signing` — `{ "expectedVersion": 4 }`.
- `POST /api/document-flow/documents/{id}/signatures` — `cms`, `clientRequestId`, `expectedVersion`; document, version и assignment определяются backend.
- `GET /api/document-flow/documents/{id}/my-assignment` — явные `canSign`, `canReject`, `canReturn`.
- `POST /api/document-flow/documents/{id}/archive` — `reason`, `expectedVersion`.

## Каталоги

- Members: `GET/POST /api/document-flow/members`, DTO использует `userId`, не `memberId` для пользователя.
- Counterparties: GET/POST collection, GET/PATCH/DELETE item. PATCH требует `expectedVersion`.
- Representatives всегда разрешаются в tenant выбранного контрагента.

## Public signing

`challenge`, `file`, `sign`, `reject` расположены под `/api/public/document-flow/signing/{token}`. Сырой token не хранится; CMS проверяется относительно locked bytes.

