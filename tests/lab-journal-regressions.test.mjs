import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('five canonical journal codes and one label directory are the only supported values', async () => {
  const types = await read('src/types/labJournal.ts');
  for (const code of ['SAMPLE_REGISTRATION', 'SOLUTION_PREPARATION', 'CHEMICAL_REAGENT_USAGE', 'ENVIRONMENT_CONDITIONS', 'TEST_RESULTS_REGISTRATION']) assert.match(types, new RegExp(code));
  assert.match(types, /LAB_JOURNAL_TYPES: Record/);
  assert.doesNotMatch(types, /CHEMICAL_REAGENT_MOVEMENT/);
});

test('service has canonical methods, compact params and a 404-only declared fallback', async () => {
  const service = await read('src/features/lab-journals/api/labJournalService.ts');
  assert.match(service, /compactQueryParams/);
  assert.match(service, /response\?\.status !== 404/);
  assert.match(service, /schemaSource: 'local'/);
  assert.match(service, /api\.post[^]*\/lab-journals\/entries/);
  assert.match(service, /api\.put/);
  assert.match(service, /api\.delete/);
  assert.doesNotMatch(service, /\/archive|\/restore|localStorage/);
});

test('entry mappers separate DTO, UI form and create/update contracts', async () => {
  const mapper = await read('src/features/lab-journals/api/labJournalMappers.ts');
  for (const name of ['mapJournalEntryDtoToModel', 'mapJournalEntryToForm', 'mapJournalFormToCreateRequest', 'mapJournalFormToUpdateRequest', 'mapJournalEntriesResponse']) assert.match(mapper, new RegExp(name));
  assert.match(mapper, /data: \{ \.\.\.dynamicFields \}/);
  assert.match(mapper, /fields: \{ \.\.\.dynamicFields \}/);
  assert.doesNotMatch(mapper, /values:\s*dynamicFields/);
});

test('list mapper supports array and common paged backend shapes', async () => {
  const mapper = await read('src/features/lab-journals/api/labJournalMappers.ts');
  for (const key of ['content', 'items', 'records', 'data']) assert.match(mapper, new RegExp(`'${key}'`));
  assert.match(mapper, /totalElements: content\.length/);
  assert.match(mapper, /totalPages: content\.length > 0 \? 1 : 0/);
});

test('mutations update and invalidate precise React Query caches', async () => {
  const hook = await read('src/features/lab-journals/hooks/useJournalEntryMutations.ts');
  const keys = await read('src/features/lab-journals/hooks/queryKeys.ts');
  assert.match(hook, /invalidateQueries/);
  assert.match(hook, /setQueryData/);
  assert.match(hook, /removeQueries/);
  for (const key of ['all', 'types', 'entries', 'entry']) assert.match(keys, new RegExp(`${key}:`));
});

test('Excel checks error blobs and always revokes object URLs', async () => {
  const service = await read('src/features/lab-journals/api/labJournalService.ts');
  assert.match(service, /responseType: 'blob'/);
  assert.match(service, /JSON\.parse/);
  assert.match(service, /content-disposition/);
  assert.match(service, /URL\.createObjectURL/);
  assert.match(service, /finally[^]*URL\.revokeObjectURL/);
  assert.match(service, /\/lab-journals\/entries\/export-template/);
});

test('local schemas implement every required business field and range', async () => {
  const schema = await read('src/features/lab-journals/schemas/journalSchemas.ts');
  for (const key of ['sampleNumber', 'sampleName', 'solutionName', 'concentration', 'reagentName', 'usedQuantity', 'roomName', 'temperature', 'humidity', 'indicatorName', 'resultValue', 'unit']) assert.match(schema, new RegExp(key));
  assert.match(schema, /min: 0, max: 100/);
  assert.match(schema, /used > initial/);
});

test('normalizeApiError preserves status, messages, errors, fields and trace id', async () => {
  const helpers = await read('src/services/apiHelpers.ts');
  for (const key of ['status', 'message', 'errors', 'fieldErrors', 'traceId']) assert.match(helpers, new RegExp(key));
  assert.match(helpers, /normalizeApiError/);
  assert.match(helpers, /parsed\.fieldErrors \|\| \{\}/);
});
