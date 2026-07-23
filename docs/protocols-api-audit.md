# Protocols API audit

The repository contains a React/Vite frontend and no backend controllers or DTO sources. The `backend` directory contains migrations and a proposed contract only. Consequently, the table below records the production contract currently called by the frontend; backend support must be verified in the backend repository or OpenAPI specification.

| Area | Method and endpoint | Request | Response used by UI | Relevant errors | Backend evidence |
|---|---|---|---|---|---|
| List | `GET /api/protocols` | Cleaned `ProtocolListQuery`; empty values are omitted | array, `content`, or `items`, with server paging metadata | 400, 401, 403, 500 | Frontend service only |
| Detail | `GET /api/protocols/{id}` | path id | protocol aggregate | 401, 403, 404, 500 | Frontend service only |
| Create | `POST /api/protocols` | canonical create DTO | complete protocol with id | 400, 403, 409, 422 | Proposed contract in `backend/docs/companies-protocols-contract.md` |
| Quick create | `POST /api/protocols/quick-create` | header, environment and complete measurement rows | complete protocol with id | 400, 403, 409, 422 | Frontend service only; backend DTO must be confirmed |
| Update | `PATCH /api/protocols/{id}` | nested `UpdateProtocolRequest`, including optimistic `version` | response is followed by aggregate reload | 400, 403, 404, 409, 422 | Frontend contract; backend `UpdateProtocolRequest` is absent here |
| Result create/update/delete | `POST/PATCH/DELETE /api/protocols/{id}/results[/{resultId}]` | `values`, `measurementDeviceId`, `normativeId` | saved result or aggregate reload | 400, 403, 404, 409, 422 | Frontend service only |
| Submit | `POST /api/protocols/{id}/ready-for-approval` | none | aggregate reload | 400, 403, 409, 422 | Frontend service only |
| Return | `POST /api/protocols/{id}/return-for-revision` | `{ comment, reason }` | aggregate reload; expected `NEEDS_REVISION` | 400, 403, 409, 422 | Frontend service only |
| Approve/sign | `POST /api/protocols/{id}/approve`, `/sign` | none / `{ cmsSignatureBase64 }` | aggregate reload | 400, 403, 409, 422 | Frontend service only |
| Corrected version | `POST /api/protocols/{id}/corrections` | `{ reason }` | a distinct protocol | 403, 404, 409, 422 | Product contract; no singular/copy fallback |
| Documents | `POST .../generate-docx`, `POST .../generate-pdf`, `GET .../download-docx`, `GET .../download-pdf` | path id; downloads use blob response | protocol / binary with Content-Disposition filename | 403, 404, 409, 503 | Frontend service only |
| Normatives | `GET /api/normatives/search` and normative directory endpoints | server filters, pagination, abort signal | page/list | 400, 403, 500 | Frontend service only |
| Devices | `GET /api/measurement-devices/available` and directory endpoints | date/laboratory filters | page/list | 400, 403, 500 | Frontend service only |
| Laboratories | `/api/laboratories` and `/api/laboratories/{id}/employees` | paging/filter or path id | laboratory/employee DTOs | 400, 403, 404, 409 | Frontend service only |
| Companies | `/api/companies` and `/api/companies/{id}/objects` | paging/filter or path id | company/real object DTOs | 400, 403, 404, 409 | Proposed contract document and frontend service |

No production protocol operation falls back to mock data. The correction flow no longer probes `/correction`, `/replace`, `/duplicate` or `/copy`. Backend work still required: publish the authoritative OpenAPI/DTO definitions, explain the quick-create `409` uniqueness rule, confirm its accepted fields, and document history/document metadata responses.
