# Protocols backend fix report

Date: 2026-08-06.

## Implemented

- `POST /api/protocols/drafts` accepts optional `testingStartDate`, `testingEndDate` and the same
  structured `environment` object used by PATCH.
- Draft environment is persisted after the protocol obtains its id; inconsistent testing dates
  return a user-facing 400 error.
- `environment.conditions.factorType` now round-trips through DTO, service, entity and database.
- PATCH resolves a supplied canonical laboratory id together with executor id, verifies that the
  employee belongs to that laboratory, and rebuilds snapshots from authoritative entities.
- Existing Java callers remain source-compatible through auxiliary record constructors.

Migration: `V66__protocol_environment_factor_type.sql` adds nullable `factor_type` and its index.
Existing data is untouched. Rollback is `DROP INDEX idx_protocol_env_factor_type` followed by
`ALTER TABLE protocol_environment_conditions DROP COLUMN factor_type`; perform it only after
confirming no new values must be retained.

Additional corrections:

- Added top-level `laboratoryId` and an explicit immutable `companyId` guard to PATCH.
- Added durable manual PEK protocol-source create/list/delete APIs with duplicate reconciliation.
- Added normative health diagnostics and CAS/formula search inputs.
- Added pollutant `limit` with a hard maximum of 100.
- Added a built-in deterministic PDF fallback for environments without LibreOffice; production
  continues to prefer LibreOffice for template-faithful conversion.
- Updated workflow fixtures to contain the actual required ambient-air fields. A local measurement
  device is supported but is no longer universally mandatory because external-laboratory rows do
  not necessarily reference the local device directory.

## Verification

- `./mvnw.cmd -q -DskipTests compile` — passed.
- `./mvnw.cmd -q "-Dtest=ProtocolServiceTest,ProtocolVersionConflictTest,ProtocolDeleteApiTest" test`
  — 40 tests, 40 passed.
- `./mvnw.cmd -q "-Dtest=ProtocolDraftContractApiTest,PollutantSearchControllerTest,PekModuleApiTest#manualProtocolSource_isDurableAndIdempotent" test`
  — 5 tests, 5 passed.
- Spring context applied Flyway through V66. `git diff --check` passed.
- `./mvnw.cmd -q test` — 629 tests executed, 24 failures and 2 errors. The new protocol contract
  tests and the 40 focused protocol workflow tests pass. Remaining full-suite failures are in
  pre-existing company/laboratory security-context isolation, older PEK role/workflow fixtures,
  reconciliation tests that still expect physical deletion instead of `STALE`, and two unrelated
  document-flow signing/fixture cases. Full-suite green is therefore not claimed.

HTTP integration tests cover the new draft and PEK endpoints. Browser E2E was not run because the
frontend repository is explicitly outside task scope. Strict rejection of unknown legacy JSON
fields and a mandatory-version cut-over remain compatibility decisions rather than silent backend
changes.
