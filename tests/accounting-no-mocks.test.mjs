import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('accounting filters contain only companies returned by the backend', async () => {
  const page = await read('src/pages/PaymentsPage.tsx');

  for (const mockValue of [
    'ecoprogress-group',
    'ecoprogress-lab',
    'ecoprogress-utilization',
    'shymkent-plast',
    'green-market',
    'asylbek-ip',
    'eco-build-kz',
  ]) {
    assert.doesNotMatch(page, new RegExp(mockValue));
  }

  assert.match(page, /new Map\(rows\.filter\(\(row\) => row\.ourCompanyId\)/);
  assert.match(page, /new Map\(rows\.filter\(\(row\) => row\.clientCompanyId\)/);
});

test('accounting records are loaded only from staff API endpoints', async () => {
  const service = await read('src/services/paymentService.ts');

  for (const endpoint of ['/staff/payments', '/staff/contracts', '/staff/debts']) {
    assert.match(service, new RegExp(endpoint.replaceAll('/', '\\/')));
  }

  assert.doesNotMatch(service, /localStorage|sessionStorage|mock|fixture|seed/i);
});
