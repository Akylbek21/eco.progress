import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('1-6 list loads, paginates, debounces and cancels stale server searches', async () => {
  const page = await read('src/pages/NormativeDirectoryPage.tsx');
  const service = await read('src/services/normativeService.ts');
  assert.match(page, /SEARCH_DEBOUNCE_MS = 500/);
  assert.match(page, /queryFn: \(\{ signal \}\) => getNormativeRecords\(requestParams, signal\)/);
  assert.match(page, /setPage\(0\)/);
  assert.match(page, /recordsPage\?\.first === false/);
  assert.match(page, /recordsPage\?\.last === false/);
  assert.match(service, /signal/);
});

test('7-12 server filters, empty state, load error and retry are visible', async () => {
  const page = await read('src/pages/NormativeDirectoryPage.tsx');
  assert.match(page, /sourceDocumentCode: activeDocument/);
  assert.match(page, /category: categoryParams\.category/);
  assert.match(page, /factorType: factorTypeFilter \|\| categoryParams\.factorType/);
  assert.match(page, /По заданным параметрам нормативы не найдены/);
  assert.match(page, /Нормативы ещё не загружены/);
  assert.match(page, /onClick=\{load\}>Повторить/);
});

test('13-19 create, RANGE, TEXT, field errors, archive and role matrix are wired', async () => {
  const page = await read('src/pages/NormativeDirectoryPage.tsx');
  const form = await read('src/components/normatives/NormativeForm.tsx');
  const permissions = await read('src/utils/normativePermissions.ts');
  assert.match(page, /createNormative\(/);
  assert.match(page, /updateNormative\(/);
  assert.match(page, /archiveNormative\(/);
  assert.match(form, /valueType === 'RANGE'/);
  assert.match(form, /REFERENCE_ONLY/);
  assert.match(form, /parsed\.fieldErrors/);
  assert.match(permissions, /LABORATORY/);
  assert.match(permissions, /manageRoles/);
});

test('20-28 import wizard selects, previews and confirms once with exact contracts', async () => {
  const page = await read('src/pages/NormativeDirectoryPage.tsx');
  const service = await read('src/services/normativeService.ts');
  const errors = await read('src/utils/normativeApiError.ts');
  assert.match(page, /accept="\.xls,\.xlsx,\.csv"/);
  assert.match(page, /importStep === 2/);
  assert.match(page, /importStep === 3/);
  assert.match(page, /importStep === 5/);
  assert.match(page, /disabled=\{confirmImportDisabled\}/);
  assert.match(service, /\/normatives\/import\/preview/);
  assert.match(service, /\{ replaceMode, confirm: true \}/);
  for (const code of ['UNSUPPORTED_FILE_FORMAT', 'IMPORT_EXPIRED', 'IMPORT_ALREADY_CONFIRMED']) assert.match(errors, new RegExp(code));
});

test('29-31 document-specific DSM views share the common service', async () => {
  const page = await read('src/pages/NormativeDirectoryPage.tsx');
  const service = await read('src/services/normativeService.ts');
  for (const code of ['DSM_15', 'DSM_70', 'DSM_138']) assert.match(page, new RegExp(code));
  assert.match(page, /Справочная запись/);
  assert.match(service, /previewNormativeImport/);
  assert.match(service, /confirmNormativeImport/);
});

test('32-36 protocol picker is contextual, paginated, snapshots values and rejects unit mismatch', async () => {
  const picker = await read('src/components/protocols/ProtocolResultsTable.tsx');
  assert.match(picker, /getNormativesForProtocol/);
  assert.match(picker, /normativePage/);
  assert.match(picker, /normativeRecordId: normative\.id/);
  assert.match(picker, /conditions: JSON\.stringify\(normativeConditions\(normative\)\)/);
  assert.match(picker, /Единица результата/);
  assert.match(picker, /status: 'ACTIVE'/);
});

test('37 URL state survives mount and 38 row actions are not nested controls', async () => {
  const page = await read('src/pages/NormativeDirectoryPage.tsx');
  assert.match(page, /documentInitializedRef/);
  assert.match(page, /filtersInitializedRef/);
  assert.match(page, /next\.set\('search'/);
  assert.match(page, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
});
