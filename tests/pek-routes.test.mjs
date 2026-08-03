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
    '/staff/pek/programs/:programId/versions',
    '/staff/pek/reports',
    '/staff/pek/reports/new',
    '/staff/pek/reports/:reportId',
  ].forEach((route) => assert.match(app, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});

test('production PEK transport contains implemented report analytics and excludes pending contracts', () => {
  assert.match(service, /reports\/\$\{id\}\/collect/);
  assert.match(service, /'submit-review' \| 'approve' \| 'archive'/);
  ['plan-fact', 'issues', 'unmatched-sources', 'collection-runs/latest', 'history'].forEach((implemented) => assert.match(service, new RegExp(implemented)));
  [
    'exceedances',
    'review-comments',
    'prepare-signing',
    'exports/',
    'submission',
    'revision',
  ].forEach((unsupported) => assert.doesNotMatch(service, new RegExp(unsupported)));
});

test('report workspace has no fake async collection progress', () => {
  assert.match(workspace, /action\.isPending/);
  assert.match(workspace, /getLatestCollection/);
  assert.doesNotMatch(workspace, /setInterval|polling|progressPercent|collection-runs/);
});

test('production source does not boot PEK mocks', () => {
  const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /pekMockWorker|VITE_ENABLE_MSW|features\/pek\/mocks/);
});
