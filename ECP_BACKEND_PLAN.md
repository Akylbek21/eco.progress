# ECOPROGRESS GROUP: backend plan for EDS contract signing

## Goal

Support legal contract signing from the React client through NCALayer.

Frontend flow:

1. Client opens an order with `contractStatus = sent`.
2. Client downloads the contract PDF bytes through `GET /api/files/documents/{fileId}`.
3. Frontend signs the PDF bytes with NCALayer and receives `signedCms`.
4. Frontend sends `signedCms` to backend:

```http
POST /api/client/orders/{orderId}/contract/sign
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "signatureProvider": "NCALayer",
  "documentId": "123",
  "signedCms": "base64-cms",
  "signerSubject": "CN=...",
  "signedAt": "2026-05-30T10:15:00.000Z"
}
```

## Backend requirements

1. Validate order access:

   - `CLIENT` can sign only own order.
   - `MANAGER` and `ADMIN` may view/sign only if business logic allows it.

2. Validate order state:

   - Order exists.
   - `contractStatus == sent` or `crmContractStatus == waiting_signature`.
   - The document belongs to this order.
   - The document type is `contract` or name/category is contract-related.

3. Validate CMS:

   - `signedCms` is present and not empty.
   - CMS signature is cryptographically valid.
   - CMS signs the same PDF bytes stored for `documentId`.
   - Certificate is not expired.
   - Certificate is trusted by Kazakhstan NCA chain.
   - Certificate is not revoked if OCSP/CRL validation is available.

4. Validate signer identity:

   - Extract signer BIN/IIN from certificate subject/serial fields.
   - Compare with client `binIin` where required.
   - Store parsed signer subject and certificate serial.

5. Persist signature:

   Recommended fields:

   ```text
   order.contractStatus = signed
   order.crmContractStatus = signed
   order.signedAt = now
   order.signatureProvider = NCALayer
   document.clientResponseStatus = signed
   ```

   Store signature audit data:

   ```text
   order_id
   document_id
   signed_cms
   signer_subject
   signer_iin_bin
   certificate_serial
   signed_at
   verified_at
   verification_status
   verification_message
   ```

6. Return updated `OrderResponse`.

## Error messages

Return `ApiResponse`:

```json
{ "data": null, "message": "..." }
```

Recommended cases:

- `400`: `signedCms обязателен`
- `400`: `Подпись не соответствует документу`
- `400`: `Сертификат просрочен`
- `400`: `Сертификат не принадлежит клиенту`
- `403`: `Нет доступа к заявке`
- `404`: `Договор не найден`
- `409`: `Договор уже подписан`

## Open decisions

Confirm these before production:

1. Should the client sign raw PDF bytes or a backend-generated SHA-256 hash?
2. Should `documentId` be `DocumentResponse.id` or GridFS `fileId`?
3. Is BIN/IIN matching mandatory for individuals and companies?
4. Where should `signedCms` be stored: SQL table, Mongo/GridFS, or both?
5. Should backend generate a detached signature file for download?
