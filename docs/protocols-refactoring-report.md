# Protocols refactoring report

## Changed files

- `src/features/protocols/api/protocolContracts.ts` — canonical API DTOs.
- `src/features/protocols/api/protocolMappers.ts` — update/result/query mappers.
- `src/features/protocols/hooks/queryKeys.ts` — stable cache keys.
- `src/features/protocols/schemas/protocolSchema.ts` — business validation.
- `src/features/protocols/utils/protocolCalculations.ts` — unit-safe compliance calculation.
- `src/features/protocols/utils/protocolTemplates.ts` — seven canonical template configurations.
- `src/services/apiProtocolService.ts` — mapper-only writes, clean queries, persisted aggregate reload.
- `src/services/protocolService.ts`, `src/services/mockProtocolService.ts` — removed `returnToDraft` alias.
- `src/pages/ProtocolCreatePage.tsx` — partial-create verification.
- `src/pages/ProtocolEditorPage.tsx` — canonical update fields and status editability.
- `src/components/protocols/CreateProtocolModal.tsx` — canonical template picker only.
- `src/types/protocols.ts` — sample/compliance/update fields.
- `tests/protocol-domain.test.ts` and protocol regression tests — DTO, template, validation, unit and device coverage.
- `docs/protocols-api-audit.md` — endpoint inventory and backend evidence.

## Endpoint changes

| Old behavior | New behavior |
|---|---|
| `POST .../return-to-draft` alias exposed in the service | Only `POST /api/protocols/{id}/return-for-revision` with a reason |
| `PATCH /api/protocols/{id}` assembled inline with flat and nested duplicate fields | Same endpoint, body produced only by `mapProtocolFormToUpdateRequest` |
| Result writes duplicated device id as `deviceId`, `measurementDeviceId` and inside `values` | Result writes contain one top-level `measurementDeviceId` |
| List forwarded empty query values | `mapProtocolsQuery` omits `undefined`, `null` and empty strings |
| Quick-create accepted partial persistence as success | Created aggregate is reloaded; row/device mismatch is reported as partial creation, never success |

## Request migration

Old update request (representative):

```json
{
  "objectId": 11,
  "laboratoryId": 20,
  "executorId": 21,
  "measurementDate": "2026-07-21",
  "productName": "Air",
  "organization": { "objectName": "Workshop" },
  "testing": { "samplingDate": "2026-07-21" }
}
```

New update request:

```json
{
  "version": 4,
  "protocolDate": "2026-07-22",
  "organization": {
    "companyId": 10,
    "objectId": 11,
    "organizationName": "Company",
    "organizationAddress": "Address",
    "objectName": "Workshop",
    "productName": "Air",
    "testingBasis": "Contract"
  },
  "laboratory": {
    "laboratoryId": 20,
    "laboratoryName": "Laboratory",
    "laboratoryAddress": "Address",
    "accreditationNumber": "KZ.01",
    "accreditationValidUntil": "2027-01-01"
  },
  "executor": { "laboratoryEmployeeId": 21, "fullName": "Employee" },
  "testing": {
    "measurementDate": "2026-07-21",
    "measurementTime": "12:00",
    "measurementPlace": "Workshop",
    "sampleDate": "2026-07-21",
    "sampleNumber": null,
    "samplingPlace": "Workshop",
    "samplingDepth": null,
    "testingStartDate": null,
    "testingEndDate": null,
    "productNormativeDocument": null,
    "samplingMethodDocument": null,
    "testingMethodDocument": "GOST",
    "purpose": null,
    "environmentConditions": null
  },
  "environment": {},
  "testingMethodDocument": "GOST",
  "complianceDocument": null,
  "explanatoryNote": null,
  "printVisibility": {}
}
```

Creation keeps `POST /api/protocols` and `POST /api/protocols/quick-create`; the significant change is that every quick-create row crosses the API boundary with `unit`, normative metadata, conditions and one `measurementDeviceId`. The UI continues accepting legacy response aliases, but no longer sends them.

Corrected DTO fields: `organization.objectId`, `laboratory.laboratoryId`, `executor.laboratoryEmployeeId`, `testing.sampleDate`, `testing.sampleNumber`, `testing.samplingPlace`, `testing.samplingDepth`, `testing.measurementDate`, `testing.measurementTime`, `testing.measurementPlace`, `testingMethodDocument`, `complianceDocument`, `explanatoryNote`, `environment.*`, `version`, and result `measurementDeviceId`/`normativeId`.

Removed write aliases: root `objectId`, root `laboratoryId`, root `executorId`, root measurement fields, root `productName`, root `testingBasis`, root `sampleDate`, `deviceId`, device ids inside `values`, and `returnToDraft`. Legacy aliases remain read-only to normalize old backend responses.

## Status actions

| Status | Edit | Submit | Return | Approve | Sign | Corrected version |
|---|---:|---:|---:|---:|---:|---:|
| `DRAFT` | yes | yes | no | no | no | no |
| `CALCULATED` | yes | yes | no | no | no | no |
| `NEEDS_REVISION` | yes | yes | no | no | no | no |
| `READY_FOR_APPROVAL` | no | no | HEAD+ | HEAD+ | no | no |
| `APPROVED` | no | no | no | no | HEAD+ | no |
| `SIGNED` | no | no | no | no | no | HEAD+ |
| `REPLACED`, `CANCELLED`, `ARCHIVED` | no | no | no | no | no | no |

## Required fields by template

All seven templates require a real `objectId`, active `laboratoryId`, active laboratory employee id, at least one result, result unit, normative and measurement device. `ambient_air`, `workplace_air`, `soil`, and `water_wastewater` require sample data. `soil` additionally requires sample number, sampling place and depth. All templates currently require environment and measurement place through the central configuration.

## Backend follow-up

This repository does not contain backend controllers, `UpdateProtocolRequest`, quick-create DTOs, or an OpenAPI file. Backend work/confirmation is required for:

1. accepting the nested update DTO documented above;
2. preserving every quick-create measurement field;
3. returning the complete aggregate with incremented `version` after writes, or supporting the subsequent detail reload;
4. corrected-version endpoint (`/correction`) and relationships;
5. protocol history and document metadata endpoints;
6. authoritative error field paths for form mapping.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — 2/2 passed.
- `npm run test` — 178 Node tests and 21 Vitest tests passed.
- `npm run build` — passed; 1,907 modules transformed; prerender and SEO audit passed.

Manual lifecycle: create a protocol for each canonical type using a real company object and active laboratory employee; fill sample/environment/results; save; submit; return with reason; resubmit; approve; sign through NCALayer; generate and download DOCX/PDF; then create a corrected version from the signed protocol. At each step refresh through `GET /api/protocols/{id}` and verify status, version, row units, normative ids, device ids, snapshots and document flags.

## 2026-07-22 contract addendum

- The UI exposes eight types, including `uv_emf_laser`; `water_wastewater` is mapped to backend `water` only at the API boundary.
- `READY` is preserved as a distinct technical backend status and is not promoted to `READY_FOR_APPROVAL` locally.
- Corrected versions use one request: `POST /api/protocols/{id}/corrections`. Singular, replace, duplicate and copy fallbacks were removed.
- Device selection accepts only `VALID`, `ACTIVE` or `EXPIRING` and rejects a verification date earlier than the selected measurement date.
- Device snapshots are collected from aggregate instruments and result rows, preventing a false "no devices" checklist state.
- `/staff/protocols/new` redirects to the canonical `/staff/protocols/create` route.
- Verification: `npm run typecheck`, `npm run lint`, `npm test` (182 Node + 24 Vitest tests) and `npm run build` (1,909 modules, prerender and SEO audit) passed.
- Backend limitation: this repository contains no `ProtocolController`, `ProtocolService`, `ProtocolApiDtos`, `ProtocolApiMapper`, `ProtocolStatus`, `ProtocolTypeRegistry`, measurement/laboratory/object controllers, or OpenAPI. The exact `QuickCreateProtocolRequest` and the server-side cause of a `409` cannot be proven from this workspace; the backend must publish that contract and return a conflict code/message plus existing protocol id where applicable.

## Creation wizard

- Creation now starts and remains inside `CreateProtocolWizardModal` on `/staff/protocols`; the URL changes only after backend success.
- `/staff/protocols/create` and `/staff/protocols/new` redirect to the protocol list.
- The wizard contains nine guarded steps, sticky navigation, responsive full-screen mobile layout, real React Query directories, React Hook Form state and a session-scoped draft.
- Company changes clear the object; laboratory changes clear the employee and row devices; type changes clear only type-dependent results, normative snapshots, devices and document fields after confirmation.
- Result rows contain their device and normative snapshot. Device availability is recalculated against the selected measurement date.
- `mapProtocolWizardToRequest` filters empty rows and produces the single quick-create request. The API adapter removes the unconfirmed `environment` object and sends supported weather values through `conditions`.
- On backend error the modal, step and values remain intact. Successful creation clears the draft, invalidates `['protocols']`, closes the modal and opens the returned protocol.
- Verification: 187 Node tests and 25 Vitest tests passed (including the final mapper test); lint, TypeScript and production build passed; 1,926 modules were transformed.
