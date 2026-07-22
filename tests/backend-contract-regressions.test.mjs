import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('journal requests use canonical type, DTO keys, PUT, DELETE and template endpoint', async () => {
  const types = await read('src/types/labJournal.ts');
  const mapper = await read('src/features/lab-journals/api/labJournalMappers.ts');
  const service = await read('src/features/lab-journals/api/labJournalService.ts');
  assert.match(types, /CHEMICAL_REAGENT_USAGE/);
  assert.doesNotMatch(types, /CHEMICAL_REAGENT_MOVEMENT/);
  for (const key of ['entryDate', 'registrationDate', 'preparationDate', 'executorName', 'note', 'data', 'fields']) assert.match(mapper, new RegExp(key));
  assert.match(service, /api\.put/);
  assert.match(service, /api\.delete/);
  assert.match(service, /\/lab-journals\/entries\/export-template/);
  assert.doesNotMatch(service, /\/archive|\/restore|\/lab-journals\/templates/);
});

test('protocol revision and normative confirm use supported contracts', async () => {
  const protocols = await read('src/services/apiProtocolService.ts');
  const normatives = await read('src/services/normativeService.ts');
  assert.match(protocols, /return-for-revision/);
  assert.doesNotMatch(protocols, /return-to-draft/);
  assert.match(normatives, /formData\.append\('file', originalFile\)/);
  assert.match(normatives, /'\/normatives\/import\/confirm'/);
  assert.doesNotMatch(normatives, /\/normatives\/import\/\$\{encodeURIComponent\(importId\)\}\/confirm/);
});

test('laboratory activity, default and employee removal avoid unsupported endpoints', async () => {
  const service = await read('src/features/laboratories/api/laboratoryService.ts');
  assert.match(service, /'\/settings\/laboratories\/default'/);
  assert.match(service, /\{ active: false \}/);
  assert.match(service, /\{ active: true \}/);
  assert.match(service, /api\.delete\(`\/laboratories\/\$\{requireId\(laboratoryId\)\}\/employees/);
  assert.doesNotMatch(service, /api\.get[^\n]*'\/laboratories\/default'|\/archive|\/restore|\/deactivate`|\/activate`/);
  assert.doesNotMatch(service, /canExecuteMeasurements, true/);
});

test('company restore operations and normalized object count are canonical', async () => {
  const service = await read('src/services/companyService.ts');
  assert.match(service, /restoreCompany/);
  assert.match(service, /restoreCompanyObject/);
  assert.match(service, /source\.objectCount/);
  assert.doesNotMatch(service, /objectsCount|facilityCount/);
});
