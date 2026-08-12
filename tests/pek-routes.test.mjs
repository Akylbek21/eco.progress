import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/features/pek/api/pekService.ts', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../src/features/pek/pages/PekReportWorkspacePage.tsx', import.meta.url), 'utf8');

test('required PEK routes are registered once', () => {
  [
    '/staff/pek',
    '/staff/pek/programs',
    '/staff/pek/programs/new',
    '/staff/pek/programs/:programId',
    '/staff/pek/programs/:programId/edit',
    '/staff/pek/reports',
    '/staff/pek/reports/new',
    '/staff/pek/reports/:reportId',
    '/staff/pek/settings',
  ].forEach((route) => assert.match(app, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  assert.doesNotMatch(app, /\/staff\/pek\/programs\/:programId\/versions/);
});

test('production PEK transport contains only backend-implemented report contracts', () => {
  assert.match(service, /reports\/\$\{id\}\/collect/);
  assert.match(service, /'submit-review' \| 'approve' \| 'archive'/);
  [
    'unmatched-sources',
    'collection-runs/latest',
    'reports/${id}/history',
    'exceedances',
    'review-comments',
    'prepare-signing',
    'exports/',
    'submission',
    'revision',
  ].forEach((unsupported) => assert.doesNotMatch(service, new RegExp(unsupported)));
});

test('report workspace does not synthesize polling or protocol links', () => {
  assert.match(workspace, /availableActions/);
  assert.doesNotMatch(workspace, /setInterval|polling|collection-runs/);
  assert.doesNotMatch(workspace, /\/staff\/protocols\?/);
});

test('production source does not boot PEK mocks', () => {
  const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /pekMockWorker|VITE_ENABLE_MSW|features\/pek\/mocks/);
});
