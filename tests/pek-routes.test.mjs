import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const service = readFileSync(new URL('../src/features/pek/api/pekService.ts', import.meta.url), 'utf8');
const programPage = readFileSync(new URL('../src/features/pek/pages/PekProgramCreatePage.tsx', import.meta.url), 'utf8');

test('all declared PEK routes are registered', () => {
  [
    '/staff/pek',
    '/staff/pek/dashboard',
    '/staff/pek/programs',
    '/staff/pek/programs/new',
    '/staff/pek/programs/:programId',
    '/staff/pek/programs/:programId/edit',
    '/staff/pek/programs/:programId/history',
    '/staff/pek/reports',
    '/staff/pek/reports/new',
    '/staff/pek/reports/:reportId',
    '/staff/pek/reports/:reportId/history',
    '/staff/pek/reports/:reportId/preview',
    '/staff/pek/settings',
  ].forEach((route) => assert.match(app, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});

test('PEK workflow uses action endpoints instead of status PATCH', () => {
  assert.match(service, /reportAction\(id, 'approve'/);
  assert.match(service, /reportAction\(id, 'submit-review'/);
  assert.match(service, /reportAction\(id, 'archive'/);
  assert.doesNotMatch(service, /patch<PekReport>\(`\/pek\/reports\/\$\{id\}`, \{[^}]*status/);
});

test('program wizard has no numeric employee id inputs or fake default rows', () => {
  assert.doesNotMatch(programPage, /type="number"[^>]*reviewerId/);
  assert.doesNotMatch(programPage, /type="number"[^>]*approverId/);
  assert.doesNotMatch(programPage, /Новый показатель|Новое мероприятие/);
  assert.match(programPage, /PekLookupSelect label="Проверяющий"/);
});

test('production PEK service has no mock or synthetic success path', () => {
  assert.doesNotMatch(service, /mock|fixture|Promise\.resolve|setTimeout/i);
  assert.match(service, /api\.get/);
  assert.match(service, /api\.post/);
});
