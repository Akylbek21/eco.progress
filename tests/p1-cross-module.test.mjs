import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('protocol calculation sends version and surfaces a version conflict without retrying', async () => {
  const api = await read('src/services/apiProtocolService.ts');
  const table = await read('src/components/protocols/ProtocolResultsTable.tsx');
  const editor = await read('src/pages/ProtocolEditorPage.tsx');
  assert.match(api, /results\/\$\{resultId\}\/calculate`[\s\S]*\{ version: requireProtocolVersion\(version\) \}/);
  assert.match(api, /\$\{protocolId\}\/calculate`, \{ version: requireProtocolVersion\(version\) \}/);
  assert.match(table, /isProtocolVersionConflict[\s\S]*await onImported\(\)/);
  assert.match(editor, /isProtocolVersionConflict[\s\S]*setConflictOpen\(true\)/);
});

test('PEK documents use versions, signatures and exact backend download/sign actions', async () => {
  const source = await read('src/features/pek/components/documents/PekReportDocuments.tsx');
  assert.match(source, /getReportDocumentVersions/);
  assert.match(source, /getReportSignatures/);
  assert.match(source, /latestVersion\?\.hasDocx === true/);
  assert.match(source, /latestVersion\?\.hasPdf === true/);
  assert.match(source, /downloadCms\.mutate\(signature\.id\)/);
});

test('client-company employee management and PEK memberships are not exposed', async () => {
  const companies = await read('src/pages/CompaniesPage.tsx');
  const pekService = await read('src/features/pek/api/pekService.ts');
  assert.doesNotMatch(companies, /Сотрудники \/ Доступ/);
  assert.doesNotMatch(companies, /MembershipAccessPanel/);
  assert.doesNotMatch(pekService, /\/pek\/companies\/\$\{companyId\}\/members/);
  assert.match(pekService, /'\/pek\/lookups\/assignees'/);
});

test('laboratory list maps status to includeInactive and eligible users trust the scoped endpoint', async () => {
  const service = await read('src/features/laboratories/api/laboratoryService.ts');
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  assert.match(service, /const includeInactive = query\.status !== 'ACTIVE'/);
  assert.match(service, /'\/laboratories', \{ params: \{ includeInactive \}, signal \}/);
  assert.match(service, /'\/laboratories\/eligible-employees', \{ params: \{ laboratoryId: requireId\(laboratoryId\) \}, signal \}/);
  assert.doesNotMatch(page, /getEligibleLaboratoryEmployees\(selected, signal\)\.then/);
});
