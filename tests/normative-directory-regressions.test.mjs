import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('physical factor filters use canonical protocol subtype codes', async () => {
  const source = await read('src/pages/NormativeDirectoryPage.tsx');
  assert.match(source, /uv: 'UV'/);
  assert.match(source, /emf: 'ELECTROMAGNETIC_FIELD'/);
  assert.match(source, /categoryCode === 'noise'\) return \{ templateId: 'noise_vibration', factorType: 'NOISE' \}/);
  assert.doesNotMatch(source, /uv: 'ULTRAVIOLET'/);
});

test('DSM-15, DSM-70, DSM-32 and DSM-138 remain available through one directory', async () => {
  const source = await read('src/pages/NormativeDirectoryPage.tsx');
  for (const code of ['DSM_15', 'DSM_70', 'DSM_32', 'DSM_138']) assert.match(source, new RegExp(code));
  assert.match(source, /groupNormativeRows\(visibleItems, activeDocument, activeCategory\)/);
  assert.doesNotMatch(source, /visibleItems\.map\(singleRecordRow\)/);
});

test('normative editor uses React Hook Form, dynamic value fields and backend field errors', async () => {
  const page = await read('src/pages/NormativeDirectoryPage.tsx');
  const form = await read('src/components/normatives/NormativeForm.tsx');
  assert.match(page, /beforeunload/);
  assert.match(page, /<NormativeForm/);
  assert.match(form, /useForm<NormativeFormValues>/);
  assert.match(form, /valueType === 'RANGE'/);
  assert.match(form, /valueType === 'TEXT' \|\| valueType === 'REFERENCE_ONLY'/);
  assert.match(form, /setError\(field/);
});

test('list state is server-paginated and persisted in URL', async () => {
  const page = await read('src/pages/NormativeDirectoryPage.tsx');
  const service = await read('src/services/normativeService.ts');
  assert.match(page, /useSearchParams/);
  assert.match(page, /PAGE_SIZE_OPTIONS = \[10, 25, 50, 100\]/);
  assert.match(page, /recordsPage\?\.last === false/);
  assert.match(service, /Array\.isArray\(primary\.items\)/);
  assert.match(service, /hasNext/);
  assert.doesNotMatch(service, /items\.length === requestedSize/);
});

test('import uses multipart preview and exact JSON confirmation contract', async () => {
  const page = await read('src/pages/NormativeDirectoryPage.tsx');
  const service = await read('src/services/normativeService.ts');
  assert.match(page, /previewNormativeImport\(selectedFiles\[0\], activeDocument, replaceMode\)/);
  assert.match(page, /confirmNormativeImport\(importBatchId, replaceMode\)/);
  assert.match(service, /formData\.append\('file', file\)/);
  assert.match(service, /formData\.append\('documentCode', documentCode\)/);
  assert.match(service, /\{ replaceMode, confirm: true \}/);
  assert.match(service, /\/normatives\/import\/\$\{encodeURIComponent\(importId\)\}\/confirm/);
});

test('roles and dangerous import operations are centralized', async () => {
  const permissions = await read('src/utils/normativePermissions.ts');
  const app = await read('src/App.tsx');
  const layout = await read('src/layouts/StaffLayout.tsx');
  assert.match(permissions, /MANAGER/);
  assert.match(permissions, /const manageRoles = new Set\(\['ADMIN', 'DIRECTOR', 'HEAD'\]\)/);
  assert.match(permissions, /roleOf\(user\) === 'ADMIN'/);
  assert.match(app, /normativeRoles/);
  assert.match(layout, /allowedRoles: normativeRoles/);
});

test('production directory is connected to the real records endpoint', async () => {
  const service = await read('src/services/normativeService.ts');
  assert.match(service, /const useMocks = false/);
  assert.match(service, /'\/normatives\/records'/);
  assert.match(service, /getNormativesForProtocol/);
});
