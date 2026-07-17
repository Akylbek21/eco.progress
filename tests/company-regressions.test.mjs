import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('company list uses server-side filters, request cancellation and pagination', async () => {
  const page = await read('src/pages/CompaniesPage.tsx');
  const service = await read('src/services/companyService.ts');
  assert.match(page, /getCompaniesPage\(\{ search: debouncedQuery/);
  assert.match(page, /queryFn: \(\{ signal \}\)/);
  assert.match(page, /Страница \{page \+ 1\} из/);
  assert.doesNotMatch(page, /const filtered = useMemo/);
  assert.match(service, /getCompaniesPage\(params: CompanyQuery = \{\}, signal\?: AbortSignal\)/);
  assert.match(service, /totalElements/);
});

test('company object archive is not implemented as destructive delete', async () => {
  const service = await read('src/services/companyService.ts');
  const archiveStart = service.indexOf('export async function archiveCompanyObject');
  const archiveSource = service.slice(archiveStart);
  assert.match(archiveSource, /objects\/\$\{objectId\}\/archive/);
  assert.doesNotMatch(archiveSource, /api\.delete/);
});

test('company and object forms expose omitted fields and protect unsaved changes', async () => {
  const form = await read('src/components/companies/CompanyForm.tsx');
  const page = await read('src/pages/CompaniesPage.tsx');
  for (const field of ['directorPosition', 'contactPhone', 'contractNumber', 'contractDate', 'objectName', 'objectAddress', 'samplingLocation', 'customerRepresentative']) {
    assert.match(form, new RegExp(`field="${field}"`));
  }
  assert.match(form, /БИН \/ ИИН должен содержать ровно 12 цифр/);
  assert.match(form, /beforeunload/);
  assert.match(page, /update\('samplingLocation'/);
  assert.match(page, /validCoordinates/);
  assert.match(page, /loading=\{loading\}/);
});

test('company mutations are restricted in routes and archived cards are read-only', async () => {
  const app = await read('src/App.tsx');
  const page = await read('src/pages/CompaniesPage.tsx');
  assert.match(app, /const companyManageRoles: UserRole\[\] = \['ADMIN', 'DIRECTOR', 'HEAD'\]/);
  assert.match(app, /companies\/new" element=\{<RoleAccess roles=\{companyManageRoles\}/);
  assert.match(page, /readOnly=\{!canManage \|\| company\.status === 'ARCHIVED'\}/);
  assert.match(app, /ErrorBoundary fallbackTitle="Не удалось открыть компании"/);
});

test('company mock mode supports writes instead of calling the real API', async () => {
  const service = await read('src/services/companyService.ts');
  assert.match(service, /mockCompanies\.unshift\(company\)/);
  assert.match(service, /company\.objects\.push\(object\)/);
  assert.match(service, /object\.status = 'ARCHIVED'/);
});
