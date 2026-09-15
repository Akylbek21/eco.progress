# Protocols backend contract audit

Audit date: 2026-08-06. Scope: backend repository only.

## Existing contract

`ProtocolController` exposes list/details, normal create, quick-create, minimal draft create,
draft/update/delete, audit, workflow (`ready-for-approval`, return, approve, sign, replace,
corrections, return-to-draft, cancel, archive, publish), preview/generation/download, result CRUD
and bulk operations, device binding, normative check, laboratory refresh and Excel import.
All controller responses use `ApiResponse<T>`.

The canonical request/response records are in `ProtocolApiDtos`. Protocol has `@Version`, content
versioning, company/object/laboratory/executor snapshots, order links and explicit PEK links.
Results retain structured normative identity and a normative snapshot. Generated document ids are
invalidated after editable content changes. Workflow mutations accept/check a version token.

PEK report source management already exists under `/api/pek/reports/{id}/sources`, including
summary, manual match, exclude and restore. Collection stores protocol/result identity and match
state; readiness and plan/fact are separate backend services.

Normative lookup supports contextual filters (document, template/subtype, physical factor and
environment fields). Pollutant search has a dedicated controller/service. Flyway migrations are
append-only.

## Confirmed gaps and corrections

- Minimal draft accepted dates/environment only after this correction; it still performs no
  ready-state validation or normative resolution.
- Header-level `environment.conditions.factorType` was discarded. It now has a nullable structured
  column and is returned by details DTO.
- PATCH previously validated executor against the old laboratory and subsequently trusted a
  client snapshot. A canonical laboratory id now causes atomic laboratory/executor resolution and
  snapshot rebuilding from database entities.
- Unknown JSON fields are still ignored on several compatibility DTOs. This is deliberate legacy
  behavior, but it conflicts with a fully strict typo-detection contract and remains a gap.
- Some optimistic-lock tokens remain optional for backward compatibility; a strict mandatory-token
  cut-over requires coordinated frontend migration.
- The existing test fixtures do not satisfy the newer type-specific readiness validation; workflow
  tests therefore fail before exercising their intended transition.

## Validation boundaries

Draft save validates only parseable supplied values and referential integrity. Company is not
replaceable through update; object changes are scoped to the existing company. Laboratory and
executor ids are canonical and active. Order/service-item and PEK references are resolved by their
services. Full template/type/result/normative validation belongs to `ready-for-approval` and later
workflow transitions, not draft persistence.

## Added stable endpoints

| Method | Endpoint | Permission | Contract |
|---|---|---|---|
| POST | `/api/protocols/drafts` | `LAB_PROTOCOL` | Minimal `templateId`; optional company/object/lab/executor/order/dates/environment. Supports `Idempotency-Key`. |
| PATCH | `/api/protocols/{id}/draft` | `LAB_PROTOCOL`, editable status | Partial `UpdateProtocolRequest`; canonical top-level `laboratoryId`, `executorId`, `version`. Company is immutable. |
| POST | `/api/pek/reports/{reportId}/protocol-sources` | `PEK_REPORT_COLLECT` | Creates an idempotent manual whole-protocol link and validates report/program/item/scope/period. |
| GET | `/api/protocols/{id}/pek-links` | `LAB_PROTOCOL` | Returns all durable report-source links for the protocol. |
| DELETE | `/api/protocols/{id}/pek-links/{linkId}` | `LAB_PROTOCOL` | Deletes only a manual link; automatic sources use exclude/restore workflow. |
| GET | `/api/normatives/search` | `LAB_PROTOCOL` | Context search, pagination capped at 100, `ACTIVE` default; CAS/formula can be supplied as search terms. |
| GET | `/api/normatives/health` | `LAB_PROTOCOL` | Total/active/by-template counts and last import timestamp/status. |
| GET | `/api/pollutants/search` | `LAB_PROTOCOL` | `query` plus `limit`; default 30, maximum 100, non-positive values return 400. |

Every JSON endpoint returns `ApiResponse<T>`. Validation failures are 422 with structured
`errors`/`fieldErrors`; invalid references are 400/404; duplicates and version conflicts are 409.
Workflow status and permission guards remain centralized in `ProtocolMutationGuard`,
`ProtocolPermissionService` and `ProtocolStatus`.

## Compatibility notes

Unknown fields remain ignored on legacy records to avoid breaking the deployed React client.
Known type-specific conditions are explicit structured fields and round-trip without loss.
Optimistic-lock version remains optional on legacy calls but is checked whenever supplied; workflow
commands expose version-bearing request contracts. A future mandatory-version cut-over must be
coordinated with the frontend.
