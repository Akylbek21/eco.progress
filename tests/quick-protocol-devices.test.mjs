import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('quick-create assigns an available device to every measurement row', async () => {
  const page = await read('src/pages/ProtocolCreatePage.tsx');
  assert.match(page, /getAvailableMeasurementDevices/);
  assert.match(page, /measurementDeviceId: string/);
  assert.match(page, /setIndicatorDevice/);
  assert.match(page, /applyDeviceToAllIndicators/);
  assert.match(page, /Выберите прибор для каждой строки измерения/);
  assert.match(page, /value=\{item\.measurementDeviceId\}/);
});

test('quick-create payload carries device aliases at row and values levels', async () => {
  const page = await read('src/pages/ProtocolCreatePage.tsx');
  const service = await read('src/services/apiProtocolService.ts');
  const types = await read('src/types/protocols.ts');

  assert.match(page, /measurementDeviceId,\s*deviceId: measurementDeviceId,\s*values:/s);
  assert.match(page, /conditionJson,\s*measurementDeviceId,\s*deviceId: measurementDeviceId/s);
  assert.match(service, /measurement\.values\?\.measurementDeviceId/);
  assert.match(service, /\{ measurementDeviceId, deviceId: measurementDeviceId \}/);
  assert.match(types, /measurementDeviceId\?: string;\s*deviceId\?: string;\s*values\?:/s);
});

