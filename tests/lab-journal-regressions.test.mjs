import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('journal forms prefer backend column definitions over static fallbacks', async () => {
  const source = await read('src/pages/LabJournalsPage.tsx');
  assert.match(source, /const configured = definition\.columns\.filter/);
  assert.match(source, /if \(configured\.length\) return configured/);
});

test('journal list aborts stale requests and ignores stale responses', async () => {
  const page = await read('src/pages/LabJournalsPage.tsx');
  const service = await read('src/services/labJournalService.ts');
  assert.match(page, /entriesRequestRef\.current\?\.abort\(\)/);
  assert.match(page, /requestSequence === entriesRequestSequence\.current/);
  assert.match(service, /getEntries\(params: LabJournalQuery, signal\?: AbortSignal\)/);
  assert.match(service, /signal,/);
});

test('journal creation requires a laboratory and editing preserves its owner', async () => {
  const source = await read('src/pages/LabJournalsPage.tsx');
  assert.match(source, /const laboratoryRequired = canFilterLaboratory && !laboratoryId/);
  assert.match(source, /editing\?\.laboratoryId \|\| laboratoryId \|\| undefined/);
  assert.match(source, /Выберите лабораторию для новой записи/);
});

test('journal export includes search and validates date ranges', async () => {
  const page = await read('src/pages/LabJournalsPage.tsx');
  const types = await read('src/types/labJournal.ts');
  assert.match(types, /Omit<LabJournalQuery, 'page' \| 'size'>/);
  assert.match(page, /search: template \? undefined : searchTrimmed \|\| undefined/);
  assert.match(page, /dateFrom <= dateTo/);
});

test('journal editor protects unsaved changes and validates domain values', async () => {
  const source = await read('src/pages/LabJournalsPage.tsx');
  assert.match(source, /Закрыть форму без сохранения изменений/);
  assert.match(source, /beforeunload/);
  assert.match(source, /futureDateField/);
  assert.match(source, /negativeField/);
  assert.doesNotMatch(source, /value \? `\$\{value\}.*: '0'/);
});

test('solution journal aliases share the preparation payload contract', async () => {
  const source = await read('src/services/labJournalService.ts');
  assert.match(source, /\['SOLUTION_PREPARATION', 'REAGENT_PREPARATION'\]/);
  assert.match(source, /nextRowNumber\(payload\.journalType, payload\.laboratoryId, items\)/);
});
