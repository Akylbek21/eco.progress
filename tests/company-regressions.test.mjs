import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const sources = Promise.all([
  read('src/pages/CompaniesPage.tsx'), read('src/services/companyService.ts'), read('src/components/companies/CompanyForm.tsx'),
  read('src/types/companies.ts'), read('src/App.tsx'), read('src/config/permissions.ts'),
]);

test('companies load the first server page and use backend pagination metadata', async () => {
  const [page, service, , types] = await sources;
  assert.match(page, /getCompanies\(\{ page, size, search:/);
  for (const field of ['totalElements', 'totalPages', 'first', 'last', 'hasNext', 'hasPrevious']) assert.match(types, new RegExp(`${field}:`));
  assert.doesNotMatch(service, /items\.length === requestedSize|items\.length === size/);
});

test('next, previous and page-size navigation are bounded by backend metadata', async () => {
  const [page] = await sources;
  assert.match(page, /pageData\?\.last !== false/);
  assert.match(page, /pageData\?\.first !== false/);
  assert.match(page, /Math\.min\(page \+ 1, Math\.max\(0, \(pageData\?\.totalPages/);
  assert.match(page, /const pageSizes = \[10, 20, 50, 100\]/);
  assert.match(page, /size: Number\(event\.target\.value\), page: 0/);
});

test('search is trimmed, debounced, cancelled and resets the page', async () => {
  const [page] = await sources;
  assert.match(page, /searchInput\.trim\(\)/);
  assert.match(page, /}, 450\)/);
  assert.match(page, /search: trimmed \|\| undefined, page: 0/);
  assert.match(page, /queryFn: \(\{ signal \}\).*signal/);
});

test('URL restores page, size, search, status and sort', async () => {
  const [page] = await sources;
  assert.match(page, /useSearchParams\(\)/);
  for (const key of ['search', 'page', 'size', 'status', 'sort']) assert.match(page, new RegExp(`searchParams\\.get\\('${key}'\\)`));
});

test('archived filter and all filter are sent to backend', async () => {
  const [page, , , types] = await sources;
  assert.match(page, /<option value="ARCHIVED">Архивные<\/option>/);
  assert.match(page, /<option value="ALL">Все<\/option>/);
  assert.match(types, /CompanyStatus \| 'ALL'/);
});

test('empty, filtered-empty and retry states are distinct', async () => {
  const [page] = await sources;
  assert.match(page, /Компании пока не добавлены/);
  assert.match(page, /По заданным параметрам компании не найдены/);
  assert.match(page, /Сбросить фильтры/);
  assert.match(page, /Не удалось загрузить компании/);
  assert.match(page, /Повторить/);
});

test('company create and update use React Hook Form and block duplicate submits', async () => {
  const [page, service, form] = await sources;
  assert.match(form, /useForm<CompanyFormValues>/);
  assert.match(page, /createCompany\(request\)/);
  assert.match(page, /updateCompany\(companyId, request\)/);
  assert.match(form, /disabled=\{busy\}/);
  assert.match(service, /api\.post<ApiResponse<unknown> \| unknown>\('\/companies', payload\)/);
});

test('BIN duplication and other backend field errors use setError', async () => {
  const [, service, form] = await sources;
  assert.match(service, /getCompanyFieldErrors/);
  assert.match(form, /setError\(target, \{ type: 'server', message \}\)/);
  assert.match(form, /БИН должен содержать ровно 12 цифр/);
});

test('company archive is confirmed, non-optimistic and invalidates related queries', async () => {
  const [page, service] = await sources;
  assert.match(page, /Архивировать компанию «/);
  assert.match(page, /Компания станет недоступна для создания новых протоколов/);
  assert.match(page, /await archiveCompany\(archiveTarget\.id\)/);
  assert.match(page, /invalidateQueries\(\{ queryKey: \['companies'\] \}\)/);
  assert.match(service, /companies\/\$\{id\}\/archive/);
});

test('company routes use auth/me permissions and have no local role matrix', async () => {
  const [, , , , app, permissions] = await sources;
  const companyPermissions = await read('src/features/companies/companyPermissions.ts');
  assert.doesNotMatch(permissions, /companyRoleMatrix/);
  assert.match(app, /CompanyPermissionAccess permission="COMPANY_VIEW"/);
  assert.match(app, /CompanyPermissionAccess permission="COMPANY_CREATE"/);
  assert.match(app, /CompanyPermissionAccess permission="COMPANY_EDIT"/);
  assert.match(companyPermissions, /user\?\.companyPermissions\?\.\[permission\] === true/);
  assert.doesNotMatch(companyPermissions, /COMPANY_OBJECT_CREATE|COMPANY_OBJECT_EDIT|COMPANY_OBJECT_ARCHIVE/);
  assert.doesNotMatch(companyPermissions, /user\.role|rolePermissions/);
});

test('object create, update and soft archive use the single company service', async () => {
  const [page, service] = await sources;
  assert.match(page, /createCompanyObject\(companyId, request\)/);
  assert.match(page, /updateCompanyObject\(companyId, editing\.id, request, editing\.version\)/);
  assert.match(page, /archiveCompanyObject\(companyId, archiveTarget\.id, archiveTarget\.version\)/);
  assert.match(service, /'If-Match': String\(version\)/);
  assert.match(service, /params: \{ version \}/);
  assert.match(service, /objects\/\$\{objectId\}\/archive/);
  assert.match(page, /getCompanyObjects\(companyId, true, signal\)/);
  assert.match(page, /restoreCompanyObject\(companyId, archiveTarget\.id, archiveTarget\.version\)/);
  assert.doesNotMatch(service, /api\.delete/);
});

test('virtual objects are editable, refreshed and never physically deleted', async () => {
  const [page, service] = await sources;
  assert.match(page, /object\.virtual.*старый объект/);
  assert.match(page, /При сохранении backend материализует старый объект/);
  assert.match(page, /invalidateQueries\(\{ queryKey: \['company-objects', companyId\] \}\)/);
  assert.doesNotMatch(service, /api\.delete|deleteCompanyObject/);
});

test('company form trims values, sends nulls and validates Kazakhstan requisites', async () => {
  const [, , form] = await sources;
  const navigationGuard = await read('src/hooks/useUnsavedChangesWarning.ts');
  assert.match(form, /value\.trim\(\) \|\| null/);
  assert.match(form, /\^KZ\\d\{2\}\[A-Z0-9\]\{16\}\$/);
  assert.match(form, /\^\[A-Z0-9\]\{8\}/);
  assert.match(form, /\^\\d\{2\}\$/);
  assert.match(navigationGuard, /beforeunload/);
  assert.match(navigationGuard, /popstate/);
  assert.match(form, /Есть несохранённые изменения\. Закрыть форму\?/);
  for (const field of ['directorName', 'responsiblePerson', 'responsiblePersonPhone']) assert.match(form, new RegExp(`${field}: nullable`));
});

test('table actions are siblings and stop row propagation', async () => {
  const [page] = await sources;
  assert.match(page, /onClick=\{stop\}/);
  assert.doesNotMatch(page, /<button[^>]*>[\s\S]{0,200}<button/);
});

test('legacy arrays have an explicitly inexact bounded total', async () => {
  const [page, service] = await sources;
  assert.match(service, /totalElementsExact: false/);
  assert.match(service, /last: true/);
  assert.match(page, /backend не вернул общее количество/);
});
