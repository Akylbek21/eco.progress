import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('protocol quick-create boundary matches the backend DTO exactly', async () => {
  const contracts = await read('src/features/protocols/api/protocolContracts.ts');
  const mapper = await read('src/features/protocols/mappers/mapProtocolWizardToRequest.ts');
  const service = await read('src/services/apiProtocolService.ts');
  assert.match(contracts, /interface QuickCreateProtocolRequest/);
  for (const field of ['templateId', 'sourceDocumentCode', 'docxTemplateCode', 'protocolDate', 'sampleDate', 'measurementDate', 'testingStartDate', 'testingEndDate', 'sourceNumber', 'companyId', 'objectId', 'laboratoryId', 'executorId', 'measurementPlace', 'conditions', 'measurements', 'printVisibility', 'orderId', 'orderServiceItemId', 'pekProgramId', 'pekReportId', 'pekControlItemId', 'pekControlEventId', 'monitoringPointId', 'emissionSourceId', 'waterOutletId']) {
    assert.match(contracts, new RegExp(`\\b${field}\\b`));
  }
  for (const field of ['samplingDate', 'deviceId', 'environment']) {
    assert.doesNotMatch(contracts.match(/interface QuickCreateProtocolRequest[\s\S]*?\n}/)?.[0] || '', new RegExp(`\\b${field}\\b`));
  }
  assert.match(mapper, /requirePositiveIntegerId/);
  for (const field of ['value:', 'pollutantCode:', 'factorType:', 'factorCode:', 'normativeValue:', 'testingMethodNd:', 'samplingMethodNd:']) {
    assert.match(mapper, new RegExp(field));
  }
  assert.match(mapper, /measurementDeviceId:/);
  assert.match(mapper, /validationMode: 'submit'|validationMode !== 'draft'/);
  assert.match(service, /'\/protocols\/quick-create'/);
});

test('protocol quick-create 500 keeps the wizard recoverable and exposes safe diagnostics', async () => {
  const wizard = await read('src/features/protocols/components/CreateProtocolWizardModal.tsx');
  const panel = await read('src/features/protocols/components/components/QuickCreateErrorPanel.tsx');
  const errors = await read('src/features/protocols/utils/quickCreateError.ts');
  const helpers = await read('src/services/apiHelpers.ts');
  assert.match(wizard, /retry: false/);
  assert.match(panel, /Повторить/);
  assert.match(panel, /Вернуться к проверке/);
  assert.match(panel, /Скопировать код ошибки/);
  assert.doesNotMatch(panel, /HTTP-|INTERNAL_SCHEMA_ERROR|Stack trace/);
  assert.match(panel, /import\.meta\.env\.DEV/);
  assert.match(errors, /Данные формы сохранены во временном черновике/);
  assert.match(errors, /resetIdempotencyKey: false/);
  for (const header of ['x-request-id', 'x-trace-id', 'trace-id']) assert.match(helpers, new RegExp(header));
});

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
