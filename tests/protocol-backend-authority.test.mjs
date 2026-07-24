import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('quick-create is idempotent, reloads persisted data and keeps canonical ids', async () => {
  const wizard = await read('src/features/protocols/components/CreateProtocolWizardModal.tsx');
  const submission = await read('src/features/protocols/utils/quickCreateSubmission.ts');
  const mapper = await read('src/features/protocols/mappers/mapProtocolWizardToRequest.ts');
  const api = await read('src/services/apiProtocolService.ts');
  assert.match(submission, /crypto\.randomUUID\(\)/);
  assert.match(wizard, /acquireQuickCreateLock\(submittingRef\)/);
  assert.match(api, /'Idempotency-Key'/);
  assert.match(api, /const persisted = await getProtocol\(protocol\.id\)/);
  assert.match(mapper, /normalizeRequiredId\(form\.companyId/);
  assert.doesNotMatch(mapper, /deviceId:/);
  assert.match(mapper, /measurementDeviceId:/);
});

test('available devices are scoped and invalid statuses are filtered', async () => {
  const wizard = await read('src/features/protocols/components/CreateProtocolWizardModal.tsx');
  assert.match(wizard, /laboratoryId: values\.laboratoryId/);
  assert.match(wizard, /measurementDate: values\.measurementDate/);
  assert.match(wizard, /templateId: values\.templateId/);
  for (const status of ['EXPIRED', 'ARCHIVED', 'INACTIVE', 'OUT_OF_SERVICE']) assert.match(wizard, new RegExp(status));
});

test('workflow uses version headers, one revision reason and backend permissions', async () => {
  const api = await read('src/services/apiProtocolService.ts');
  const permissions = await read('src/utils/protocolPermissions.ts');
  assert.match(api, /'If-Match'/);
  assert.match(api, /\{ reason: comment \}/);
  assert.doesNotMatch(api, /\{ comment, reason:/);
  assert.match(permissions, /protocol\.permissions/);
  assert.match(permissions, /canPublishToClient/);
});

test('bulk result operations use atomic backend endpoints', async () => {
  const table = await read('src/components/protocols/ProtocolResultsTable.tsx');
  const api = await read('src/services/apiProtocolService.ts');
  assert.doesNotMatch(table, /Promise\.allSettled/);
  assert.match(api, /results\/bulk-update/);
  assert.match(api, /results\/bulk-delete/);
});

test('orders use linked protocols and backend completion decision', async () => {
  const page = await read('src/pages/StaffPages.tsx');
  const adapter = await read('src/services/backendAdapters.ts');
  assert.match(page, /order\.linkedProtocol/);
  assert.match(page, /order\.canComplete === true/);
  assert.match(page, /order\.blockingReasons/);
  assert.doesNotMatch(page, /updateLaboratoryStatus\(order\.id, 'result_ready'/);
  assert.match(adapter, /linkedProtocol:/);
});
