import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const servicePath = 'src/features/laboratories/api/laboratoryService.ts';

test('laboratory service exposes the canonical API surface', async () => {
  const source = await read(servicePath);
  for (const method of ['getLaboratories', 'getLaboratory', 'getDefaultLaboratory', 'createLaboratory', 'updateLaboratory', 'setDefaultLaboratory', 'deactivateLaboratory', 'activateLaboratory', 'getLaboratoryEmployees', 'getEligibleLaboratoryEmployees', 'addLaboratoryEmployee', 'updateLaboratoryEmployee', 'deactivateLaboratoryEmployee', 'uploadLaboratoryLogo', 'getLaboratoryLogoUrl', 'removeLaboratoryLogo']) assert.match(source, new RegExp(method));
  assert.match(source, /api\.get[^\n]*'\/laboratories'/);
  assert.match(source, /PageResponse<LaboratoryListItem>/);
  assert.doesNotMatch(source, /api\.get[^\n]*'\/laboratories\/default'/);
});

test('default, active state and employee removal use supported contracts only', async () => {
  const source = await read(servicePath);
  assert.match(source, /'\/settings\/laboratories\/default'/);
  assert.match(source, /api\.patch\(`\/laboratories\/\$\{requireId\(id\)\}`/);
  assert.match(source, /\{ isDefault: true \}/);
  assert.match(source, /\{ active: false \}/);
  assert.match(source, /\{ active: true \}/);
  assert.match(source, /api\.delete\(`\/laboratories\/\$\{requireId\(laboratoryId\)\}\/employees/);
  assert.doesNotMatch(source, /\/archive|\/restore|\/deactivate`|\/activate`/);
});

test('list uses no ignored server params and reads accept AbortSignal', async () => {
  const source = await read(servicePath);
  assert.match(source, /api\.get<ApiResponse<unknown> \| unknown>\('\/laboratories', \{ signal \}\)/);
  assert.match(source, /getLaboratory\(id: string \| number, signal\?: AbortSignal\)/);
  assert.match(source, /getEligibleLaboratoryEmployees\(laboratoryId: string \| number, signal\?: AbortSignal\)/);
  assert.match(source, /signal: options\.signal/);
});

test('logo upload uses FormData without a manual multipart boundary', async () => {
  const source = await read(servicePath);
  assert.match(source, /const formData = new FormData\(\); formData\.append\('file', file\)/);
  assert.doesNotMatch(source, /Content-Type.*multipart\/form-data/);
});

test('laboratory route and menu share ADMIN DIRECTOR HEAD LABORATORY roles', async () => {
  const app = await read('src/App.tsx');
  const layout = await read('src/layouts/StaffLayout.tsx');
  assert.match(app, /settings\/laboratories" element=\{<RoleAccess roles=\{\['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'\]\}/);
  assert.match(layout, /allowedRoles: \['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'\]/);
});
