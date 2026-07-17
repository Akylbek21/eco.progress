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
  assert.doesNotMatch(source, /emf: 'EMF'/);
});

test('air limits and summation groups are combined into directory rows', async () => {
  const source = await read('src/pages/NormativeDirectoryPage.tsx');
  assert.match(source, /const groupNormativeRows =/);
  assert.match(source, /groupNormativeRows\(visibleItems, activeDocument, activeCategory\)/);
  assert.match(source, /label: 'Макс\. разовая'/);
  assert.match(source, /label: 'Среднесуточная'/);
  assert.doesNotMatch(source, /visibleItems\.map\(singleRecordRow\)/);
});

test('normative editor validates values and protects unsaved work', async () => {
  const source = await read('src/pages/NormativeDirectoryPage.tsx');
  assert.match(source, /normalizeNumericInput/);
  assert.match(source, /Минимум не может быть больше максимума/);
  assert.match(source, /beforeunload/);
  assert.match(source, /const \[saving, setSaving\] = useState\(false\)/);
  assert.match(source, /createNormative\(/);
});

test('dangerous imports require confirmation and preview warnings stay separate', async () => {
  const page = await read('src/pages/NormativeDirectoryPage.tsx');
  const service = await read('src/services/normativeService.ts');
  assert.match(page, /window\.confirm\('Импортировать ДСМ-15/);
  assert.match(page, /window\.confirm\('Импортировать ДСМ-32/);
  assert.match(page, /window\.confirm\('Откатить импорт DSM_138/);
  assert.match(service, /normalizeImportErrors\(item\.errors, item\.validationErrors\)/);
  assert.doesNotMatch(service, /created: Number\([^\n]*item\.totalRecords/);
});

test('mock directory supports seeded data and pagination', async () => {
  const service = await read('src/services/normativeService.ts');
  const mocks = await read('src/mocks/mockNormatives.ts');
  assert.match(service, /filtered\.slice\(page \* size, page \* size \+ size\)/);
  assert.match(service, /mockNormatives\.unshift\(created\)/);
  assert.match(mocks, /mock-air-nitrogen-max/);
  assert.match(mocks, /mock-noise/);
});
