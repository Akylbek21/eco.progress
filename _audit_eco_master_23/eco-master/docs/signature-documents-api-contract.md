# Signature Documents API Contract

Feature: "Подпись документов" - simplified, self-service, single-user document upload + CMS/ЭЦП
signing + signed-package download. Package: `kz.eco.signaturedoc`. Base path:
`/api/staff/signature-documents`.

This module deliberately reuses existing infrastructure instead of duplicating it:

| Concern | Reused component |
|---|---|
| File storage (original + CMS bytes) | `kz.eco.storage.FileStorageService` |
| CMS/CAdES cryptographic verification | `kz.eco.signature.SignatureVerificationService` |
| Certificate validity-window extraction | `kz.ecoprogress.documentflow.signing.CmsCertificateExtractor` |
| Company/organization resolution | `kz.ecoprogress.documentflow.access.OrganizationResolver` |
| Idempotency-Key handling | `kz.ecoprogress.documentflow.infrastructure.DocumentFlowIdempotencyService` (scopes `signature-document-upload` / `signature-document-sign`) |
| Response envelope | `kz.eco.common.ApiResponse` |
| Exceptions -> HTTP status | existing `kz.eco.common.exception.*` + `GlobalExceptionHandler` |

Not reused (explicitly out of scope for this feature): organization routing, counterparties,
multi-step signing routes, subscription/entitlement checks (`UsageLimitService` etc.) - none of
these are called anywhere in this module.

## Authentication & scoping

Every endpoint requires an authenticated staff user (`CurrentUser.get()`). `companyId` is
**never** accepted from the client - it is resolved server-side via `OrganizationResolver`. A
user sees only their own documents (`createdByUserId` = caller) within their own company, unless
they hold the separately-gated `SIGNATURE_DOCUMENT_ADMIN_VIEW` permission (currently: `ADMIN`
role only), which grants read access to all documents in the caller's own company - never across
companies, and never bypassing the company check itself.

## Permissions

| Constant | Roles |
|---|---|
| `SIGNATURE_DOCUMENT_READ/CREATE/SIGN/DOWNLOAD/ARCHIVE` | ADMIN, DIRECTOR, HEAD, MANAGER, ACCOUNTANT, ECOLOGIST, LABORATORY, WASTE_SPECIALIST |
| `SIGNATURE_DOCUMENT_ADMIN_VIEW` | ADMIN only - extended, same-company, cross-owner read access |

## Document lifecycle

`DRAFT -> AWAITING_SIGNATURE -> SIGNED -> ARCHIVED`, plus `DRAFT -> ARCHIVED` and
`AWAITING_SIGNATURE -> DRAFT/ARCHIVED`. `SIGNATURE_FAILED` exists only as an audit-log annotation
- a failed signature attempt does **not** leave the document in a hard terminal state; it stays
`AWAITING_SIGNATURE` so the employee can retry via a fresh `prepare-signing` call. There is no
update/overwrite-content endpoint: a changed file is always a new document.

## Endpoints

### `POST /api/staff/signature-documents`
Multipart upload. Fields: `file` (required), `title` (optional), `description` (optional).
Header: `Idempotency-Key` (optional but recommended).

Validation: extension + declared Content-Type + magic bytes (where a reliable signature exists -
PDF/DOCX/XLSX/PPTX/DOC/XLS/PPT/JPG/PNG; TXT/CSV/RTF/XML rely on extension+Content-Type only,
documented gap - no magic-byte-sniffing library like Apache Tika exists in this project's
pom.xml). Max size: `eco.signaturedoc.max-file-size-bytes` (default 25 MB / 26214400 bytes).

Response `200`:
```json
{
  "data": {
    "id": 42, "companyId": 7, "createdByUserId": 15, "title": "Акт", "description": null,
    "originalFileName": "act.pdf", "mimeType": "application/pdf", "fileSize": 10240,
    "sha256": "3a7bd3e2...", "status": "DRAFT", "version": 0,
    "createdAt": "2026-08-11T10:00:00", "updatedAt": "2026-08-11T10:00:00", "signedAt": null
  },
  "message": "Документ загружен", "success": true
}
```

Errors: `FILE_TOO_LARGE` (400), `UNSUPPORTED_FILE_TYPE` (400).

### `GET /api/staff/signature-documents?page=0&size=20`
Paginated list, scoped to caller's own documents (or all in-company if admin-extended access).

```json
{"data": {"items": [ /* DocumentResponse[] */ ], "totalElements": 3, "totalPages": 1, "page": 0, "size": 20}}
```

### `GET /api/staff/signature-documents/{id}`
Detail. `404 DOCUMENT_NOT_FOUND` if missing or not owned/accessible (tenant/ownership isolation -
existence is never leaked to a caller who lacks access).

### `GET /api/staff/signature-documents/{id}/content`
Streams the original file bytes with correct `Content-Type`/`Content-Disposition`.

### `POST /api/staff/signature-documents/{id}/prepare-signing`
Creates a short-lived signing session (`eco.signaturedoc.signing-session-ttl-minutes`, default 15
min) and transitions the document to `AWAITING_SIGNATURE`.

```json
{
  "data": {
    "signingSessionId": "b6e2...", "documentId": 42, "version": 1,
    "sha256": "3a7bd3e2...", "contentUrl": "/api/staff/signature-documents/42/content",
    "signatureFormat": "DETACHED_CMS", "expiresAt": "2026-08-11T10:15:00"
  }
}
```
Errors: `DOCUMENT_ALREADY_SIGNED` (409), `DOCUMENT_VERSION_CONFLICT` (409, e.g. archived).

### `POST /api/staff/signature-documents/{id}/signatures`
Header: `Idempotency-Key` (optional). Body:
```json
{
  "signingSessionId": "b6e2...", "documentId": 42, "version": 1,
  "sha256": "3a7bd3e2...", "cmsBase64": "MIIF..."
}
```

Verification sequence (never short-circuited, every step's failure is audited with a specific
error code and does not leave the document in `SIGNED`):
1. Session exists / not consumed / not expired -> `SIGNING_SESSION_EXPIRED`.
2. Requested `version`/`sha256` match the session's captured values and the document's current
   state -> `DOCUMENT_VERSION_CONFLICT` / `DOCUMENT_HASH_MISMATCH`.
3. Freshly reloaded stored bytes re-hashed and compared against the document's own `sha256` ->
   `DOCUMENT_HASH_MISMATCH` (storage-integrity check, independent of the client-supplied hash).
4. Caller has a linked IIN (`User.iin`) -> `CERTIFICATE_PROFILE_NOT_LINKED` if not.
5. Certificate validity window (`notBefore`/`notAfter`) against now -> `CERTIFICATE_EXPIRED`.
6. Real BouncyCastle CMS/CAdES verification against the actual bytes -> `INVALID_CMS_SIGNATURE` /
   `SIGNATURE_VERIFICATION_FAILED`.
7. Certificate's IIN (from CMS SERIALNUMBER RDN / NCA OID 1.2.398.3.3.4.1) equals the caller's
   linked IIN -> `CERTIFICATE_OWNER_MISMATCH`.
8. Only on full success: CMS stored, `SignatureDocumentSignature` persisted, document -> `SIGNED`,
   session consumed.

`CERTIFICATE_REVOKED` is a defined error code that can **never actually be produced** - there is
no CRL/OCSP integration anywhere in this codebase (same documented limitation as
`kz.ecoprogress.documentflow.signing.CmsDocumentVerificationService`). No TSA either.

Response `200`:
```json
{
  "data": {
    "id": 9, "documentId": 42, "documentVersion": 1, "signerUserId": 15,
    "certificateSerialNumber": null, "certificateSubject": "CN=...,O=...,SERIALNUMBER=990101300123",
    "certificateIssuer": null, "certificateIin": "990101300123", "certificateBin": null,
    "certificateValidFrom": "2025-01-01", "certificateValidTo": "2027-01-01",
    "signatureAlgorithm": "SHA256withRSA (CMS/CAdES)", "verificationStatus": "VERIFIED",
    "verificationMessage": null, "signedAt": "2026-08-11T10:05:00"
  },
  "message": "Документ подписан"
}
```

### `GET /api/staff/signature-documents/{id}/signatures`
List of `SignatureResponse` for the document, newest first.

### `GET /api/staff/signature-documents/{id}/signed-package`
`200`, binary ZIP (`application/octet-stream`), only when `status=SIGNED`; `409
DOCUMENT_VERSION_CONFLICT` otherwise. Filename: `<safe-title>_signed_<yyyy-MM-dd>.zip`. Contains:
- `<originalFileName>` - the original bytes, unmodified.
- `<originalFileName>.p7s` - the detached CMS signature blob.
- `signature-info.json` - `documentId`, `version`, `sha256`, `signedAt`, certificate fields,
  `verificationStatus`, and explicit `crlChecked`/`ocspChecked`/`timestampAuthorityChecked: false`
  flags (never faked as `true`).

No PDF verification report is generated - `kz.eco.pek`'s and `kz.eco.protocol`'s docgen packages
are both coupled to their own domain models and would need significant new work to adapt to an
arbitrary uploaded file; documented gap, not attempted.

### `POST /api/staff/signature-documents/{id}/archive`
Body (optional): `{"reason": "..."}` (currently unused, accepted for forward compatibility).
`409 DOCUMENT_ALREADY_ARCHIVED` if already archived.

## Business error codes

| Code | HTTP | Meaning |
|---|---|---|
| `FILE_TOO_LARGE` | 400 | Exceeds `eco.signaturedoc.max-file-size-bytes` |
| `UNSUPPORTED_FILE_TYPE` | 400 | Extension/Content-Type/magic-bytes not in the allowlist, or unsafe filename |
| `DOCUMENT_NOT_FOUND` | 404 | Missing, or not accessible to caller (tenant/ownership isolation) |
| `DOCUMENT_ACCESS_DENIED` | 404 | Same-company but not owned, no extended access (also surfaced as 404, not 403, to avoid existence leaks) |
| `DOCUMENT_VERSION_CONFLICT` | 409 | Stale `version`, or an invalid status transition |
| `DOCUMENT_ALREADY_SIGNED` | 409 | Attempted prepare-signing/re-sign on a `SIGNED` document |
| `DOCUMENT_ALREADY_ARCHIVED` | 409 | Attempted archive on an `ARCHIVED` document |
| `DOCUMENT_HASH_MISMATCH` | 409 | Client-supplied or storage-reloaded hash mismatch |
| `SIGNING_SESSION_EXPIRED` | 400 | Session missing/expired/already consumed/wrong document |
| `INVALID_CMS_SIGNATURE` | 400 | CMS blob does not parse / certificate not extractable |
| `CERTIFICATE_EXPIRED` | 400 | Certificate outside `notBefore`/`notAfter` at signing time |
| `CERTIFICATE_REVOKED` | - | Defined for symmetry; never actually produced (no CRL/OCSP) |
| `CERTIFICATE_OWNER_MISMATCH` | 400 | Certificate IIN != caller's linked `User.iin` |
| `CERTIFICATE_PROFILE_NOT_LINKED` | 400 | Caller has no `iin` linked to their account |
| `SIGNATURE_VERIFICATION_FAILED` | 400 | Cryptographic verification failed / doesn't cover the actual bytes |

All errors follow the existing `ApiResponse` envelope (`success:false`, `message`, `code`,
`errors`) - never a raw stack trace or exception message beyond what the specific business
exception's message already sanitizes.

## Known, documented limitations

- No CRL/OCSP/TSA revocation or timestamping checks anywhere - `CERTIFICATE_REVOKED` can never
  fire; this mirrors the existing `kz.ecoprogress.documentflow.signing` module's own documented
  limitation, not a regression introduced by this feature.
- Magic-byte checking only covers formats with a reliable binary signature (PDF, OOXML, legacy
  OLE2, JPEG, PNG); TXT/CSV/RTF/XML rely on extension + declared Content-Type only.
- No PDF verification report in the signed package (see `signed-package` section above).
- `certificateBin`/`certificateIssuer`/`certificateSerialNumber` (X.509 serial, distinct from the
  IIN) are not populated - `SignatureInfo`/`SignatureVerificationService` do not currently expose
  these fields; only what that shared service already extracts is stored.
