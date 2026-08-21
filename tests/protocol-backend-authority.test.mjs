import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('workflow keeps version in body, one revision reason and backend permissions', async () => {
  const api = await read('src/services/apiProtocolService.ts');
  const client = await read('src/services/api.ts');
  const permissions = await read('src/utils/protocolPermissions.ts');
  const types = await read('src/types/protocols.ts');
  assert.doesNotMatch(api, /'If-Match'/);
  assert.doesNotMatch(client, /'If-Match'/);
  assert.doesNotMatch(client, /version: bodyVersion, \.\.\.body/);
  assert.match(api, /\{ version: requireProtocolVersion\(request\.version\), reason \}/);
  assert.doesNotMatch(api, /\{ comment, reason:/);
  assert.match(permissions, /hasProtocolAction/);
  assert.match(api, /cmsSignatureBase64/);
  assert.match(types, /'publish'/);
  assert.match(permissions, /hasProtocolAction\(protocol \|\| undefined, 'returnForRevision'\)/);
});

test('all result changes use the single atomic draft-results endpoint', async () => {
  const table = await read('src/components/protocols/ProtocolResultsTable.tsx');
  const api = await read('src/services/apiProtocolService.ts');
  const bulkAdd = table.slice(table.indexOf('const addBulk'), table.indexOf('const addManualIndicator'));
  assert.doesNotMatch(table, /Promise\.allSettled/);
  assert.match(bulkAdd, /saveProtocolDraftResults/);
  assert.doesNotMatch(bulkAdd, /addProtocolResult/);
  assert.match(api, /protocols\/\$\{protocolId\}\/draft-results/);
  assert.match(api, /api\.patch[^\n]+draft-results/);
  assert.doesNotMatch(api, /api\.put[^\n]+draft-results/);
  assert.match(api, /saveProtocolDraftResults/);
  assert.doesNotMatch(api, /results\/bulk-device/);
  assert.doesNotMatch(api, /results\/bulk-place/);
  assert.doesNotMatch(api, /results\/bulk-update/);
  assert.doesNotMatch(api, /results\/bulk-delete/);
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
