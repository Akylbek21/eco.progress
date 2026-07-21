import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('journal service uses the canonical real backend surface', async () => {
  const source = await read('src/services/labJournalService.ts');
  assert.match(source, /getJournalTypesResult/);
  assert.match(source, /getEntries/);
  assert.match(source, /getEntry/);
  assert.match(source, /createEntry/);
  assert.match(source, /updateEntry/);
  assert.match(source, /archiveEntry/);
  assert.match(source, /restoreEntry/);
  assert.match(source, /exportJournal/);
  assert.match(source, /downloadTemplate/);
  assert.doesNotMatch(source, /localStorage|tableToExcelBlob/);
});

test('journal fallback is schema v2 and contains only canonical backend keys', async () => {
  const source = await read('src/types/labJournal.ts');
  assert.match(source, /JOURNAL_SCHEMA_VERSION = 2/);
  for (const key of ['preparationDate', 'solutionExpiryDate', 'incomingQuantity', 'outgoingQuantity', 'relativeHumidityPercent', 'registrationDate']) assert.match(source, new RegExp(key));
  for (const key of ["'preparedDate'", "'income'", "'expense'", "'humidity'", "'temperature'"]) assert.doesNotMatch(source, new RegExp(key));
});

test('server pagination uses backend metadata and React Query cancellation', async () => {
  const service = await read('src/services/labJournalService.ts');
  const page = await read('src/pages/LabJournalsPage.tsx');
  assert.match(service, /totalElements: number\(payload\.totalElements\)/);
  assert.match(service, /totalPages: number\(payload\.totalPages\)/);
  assert.match(service, /hasNext: payload\.hasNext === true/);
  assert.match(service, /signal/);
  assert.match(page, /placeholderData: keepPreviousData/);
  assert.doesNotMatch(page, /items\.length === size/);
});

test('entry payload is schema-bound and preserves zero and false', async () => {
  const source = await read('src/utils/journalSchema.ts');
  assert.match(source, /definition\.columns\.reduce/);
  assert.match(source, /value === undefined \|\| value === null \|\| value === ''/);
  assert.match(source, /column\.type === 'boolean'/);
  assert.match(source, /column\.type === 'number'/);
  assert.doesNotMatch(source, /if \(!value\)/);
});

test('export validates blob and template uses the documented endpoint', async () => {
  const source = await read('src/services/labJournalService.ts');
  assert.match(source, /ensureSpreadsheet/);
  assert.match(source, /contentType\.includes\('json'\)/);
  assert.match(source, /content-disposition/);
  assert.match(source, /includeArchived/);
  assert.match(source, /`\/lab-journals\/templates\/\$\{journalType\}`/);
});

test('journal route and menu share the full view role matrix', async () => {
  const app = await read('src/App.tsx');
  const layout = await read('src/layouts/StaffLayout.tsx');
  const roles = /\['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'\]/;
  assert.match(app, roles);
  assert.match(layout, roles);
});

