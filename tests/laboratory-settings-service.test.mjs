import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('laboratory service exposes one canonical API surface', async () => {
  const source = await read('src/services/laboratorySettingsService.ts');
  for (const method of ['getLaboratories', 'getLaboratory', 'createLaboratory', 'updateLaboratory', 'setDefaultLaboratory', 'archiveLaboratory', 'restoreLaboratory', 'getEmployees', 'getEligibleEmployees', 'addEmployee', 'updateEmployee', 'deactivateEmployee', 'activateEmployee', 'uploadLogo', 'getLogoUrl', 'removeLogo']) assert.match(source, new RegExp(method));
  assert.match(source, /'\/laboratories'/);
  assert.match(source, /PageResponse<LaboratoryListItem>/);
});

test('employee status calls use supported POST endpoints and explicit includeInactive', async () => {
  const source = await read('src/services/laboratorySettingsService.ts');
  assert.match(source, /params: \{ includeInactive: options\.includeInactive === true \}/);
  assert.match(source, /api\.post\(`\/laboratories\/\$\{requireId\(laboratoryId\)\}\/employees\/\$\{requireId\(employeeId, 'сотрудника'\)\}\/deactivate`\)/);
  assert.match(source, /\/activate`\)/);
  assert.doesNotMatch(source, /api\.patch\([^\n]*\/deactivate/);
  assert.doesNotMatch(source, /params: options\.includeInactive \? undefined/);
});

test('detail, employee and eligible reads accept abort signals', async () => {
  const source = await read('src/services/laboratorySettingsService.ts');
  assert.match(source, /getLaboratory\(id: string \| number, signal\?: AbortSignal\)/);
  assert.match(source, /getEligibleLaboratoryEmployees\(laboratoryId: string \| number, signal\?: AbortSignal\)/);
  assert.match(source, /signal: options\.signal/);
});

test('logo upload uses FormData without manually setting multipart boundary', async () => {
  const source = await read('src/services/laboratorySettingsService.ts');
  assert.match(source, /const formData = new FormData\(\); formData\.append\('file', file\)/);
  assert.doesNotMatch(source, /Content-Type.*multipart\/form-data/);
});

test('laboratory route and menu share ADMIN DIRECTOR HEAD LABORATORY roles', async () => {
  const app = await read('src/App.tsx');
  const layout = await read('src/layouts/StaffLayout.tsx');
  assert.match(app, /settings\/laboratories" element=\{<RoleAccess roles=\{\['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'\]\}/);
  assert.match(layout, /label: 'Лаборатории'.*allowedRoles: \['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'\]/);
});
