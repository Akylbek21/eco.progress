import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('protocol calculation sends version and refreshes on a version conflict', async () => {
  const api = await read('src/services/apiProtocolService.ts');
  const table = await read('src/components/protocols/ProtocolResultsTable.tsx');
  const editor = await read('src/pages/ProtocolEditorPage.tsx');
  assert.match(api, /results\/\$\{resultId\}\/calculate`[\s\S]*\{ version \}/);
  assert.match(api, /\$\{protocolId\}\/calculate`, \{ version \}/);
  assert.match(table, /isProtocolVersionConflict[\s\S]*await onImported\(\)/);
  assert.match(editor, /isProtocolVersionConflict[\s\S]*protocolService\.getProtocol\(protocol\.id\)/);
});

test('PEK documents use versions, signatures and exact backend download/sign actions', async () => {
  const source = await read('src/features/pek/components/documents/PekReportDocuments.tsx');
  assert.match(source, /getReportDocumentVersions/);
  assert.match(source, /getReportSignatures/);
  assert.match(source, /availableActions\.downloadDocx === true/);
  assert.match(source, /availableActions\.downloadPdf === true/);
  assert.match(source, /availableActions\.sign === true/);
});

test('company and PEK memberships use only the confirmed CRUD endpoints and reload after mutations', async () => {
  const service = await read('src/services/membershipService.ts');
  const panel = await read('src/components/memberships/MembershipAccessPanel.tsx');
  const companies = await read('src/pages/CompaniesPage.tsx');
  const pek = await read('src/features/pek/pages/PekMembershipsPage.tsx');
  const pekService = await read('src/features/pek/api/pekService.ts');
  assert.match(service, /`\/pek\/companies\/\$\{companyId\}\/members`/);
  assert.match(service, /`\/companies\/\$\{companyId\}\/members`/);
  assert.match(service, /api\.post\(base\(scope, companyId\), body\)/);
  assert.match(service, /api\.patch\(`\$\{base\(scope, companyId\)\}\/\$\{membershipId\}`, body\)/);
  assert.match(service, /api\.delete\(`\$\{base\(scope, companyId\)\}\/\$\{membershipId\}`\)/);
  assert.match(panel, /await reload\(\)/);
  assert.match(companies, /Сотрудники \/ Доступ/);
  assert.match(companies, /hasCompanyPermission\(user, 'COMPANY_EDIT'\)/);
  assert.match(pekService, /getPekMemberships:[\s\S]*`\/pek\/companies\/\$\{companyId\}\/members`/);
  assert.match(pekService, /addPekMembership:[\s\S]*api\.post\(`\/pek\/companies\/\$\{companyId\}\/members`, body\)/);
  assert.match(pekService, /updatePekMembership:[\s\S]*api\.patch\(`\/pek\/companies\/\$\{companyId\}\/members\/\$\{membershipId\}`, body\)/);
  assert.match(pekService, /deactivatePekMembership:[\s\S]*api\.delete\(`\/pek\/companies\/\$\{companyId\}\/members\/\$\{membershipId\}`\)/);
  assert.match(pek, /invalidateQueries/);
});

test('laboratory list maps status to includeInactive and eligible users trust the scoped endpoint', async () => {
  const service = await read('src/features/laboratories/api/laboratoryService.ts');
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  assert.match(service, /const includeInactive = query\.status !== 'ACTIVE'/);
  assert.match(service, /'\/laboratories', \{ params: \{ includeInactive \}, signal \}/);
  assert.match(service, /'\/laboratories\/eligible-employees', \{ params: \{ laboratoryId: requireId\(laboratoryId\) \}, signal \}/);
  assert.doesNotMatch(page, /getEligibleLaboratoryEmployees\(selected, signal\)\.then/);
});
