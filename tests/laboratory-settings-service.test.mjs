import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('laboratory reads use supported settings and collection endpoints', async () => {
  const source = await read('src/services/laboratorySettingsService.ts');
  assert.match(source, /getLaboratory\(id:[\s\S]*return getLaboratorySettings\(id, signal\)/);
  assert.match(source, /`\/settings\/laboratories\/\$\{laboratoryId\}`/);
  assert.doesNotMatch(source, /api\.get[^\n]*settings\/laboratories\/default/);
  assert.match(source, /getDefaultLaboratory[\s\S]*laboratories\.find\(\(laboratory\) => laboratory\.isDefault\)/);
});

test('simultaneous laboratory list loads share one request', async () => {
  const source = await read('src/services/laboratorySettingsService.ts');
  assert.match(source, /let laboratoriesRequest: Promise<LaboratorySummary\[]> \| null = null/);
  assert.match(source, /if \(!laboratoriesRequest\)/);
  assert.match(source, /\.finally\(\(\) => \{\s*laboratoriesRequest = null;/s);
});

test('laboratory settings support mocks and use non-destructive employee deactivation', async () => {
  const service = await read('src/services/laboratorySettingsService.ts');
  assert.match(service, /VITE_USE_PROTOCOL_MOCKS/);
  assert.match(service, /mockLaboratorySettings/);
  assert.match(service, /employees\/\$\{employee\}\/deactivate/);
  assert.doesNotMatch(service, /api\.delete\(`\/laboratories\/\$\{requireId\(laboratoryId\)\}\/employees/);
  assert.match(service, /\/laboratories\/eligible-employees/);
});

test('laboratory detail and employees accept abort signals and reject empty ids', async () => {
  const service = await read('src/services/laboratorySettingsService.ts');
  assert.match(service, /getLaboratorySettings\(id: string \| number, signal\?: AbortSignal\)/);
  assert.match(service, /includeInactive\?: boolean; signal\?: AbortSignal/);
  assert.match(service, /Backend вернул пустую карточку лаборатории/);
  assert.match(service, /Backend не вернул ID сотрудника лаборатории/);
});

test('laboratory page guards stale requests and preserves unsaved profile data on logo deletion', async () => {
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  assert.match(page, /selectionRequestRef\.current\?\.abort\(\)/);
  assert.match(page, /sequence !== selectionSequenceRef\.current/);
  assert.match(page, /const hadUnsavedChanges = dirty/);
  assert.match(page, /setProfile\(\(current\) => \(\{ \.\.\.current, logoUrl: '' \}\)\)/);
  assert.doesNotMatch(page, /const refreshed = await getLaboratory\(profile\.id\)/);
});

test('employee editor protects drafts and separates mutation success from reload failure', async () => {
  const page = await read('src/pages/LaboratorySettingsPage.tsx');
  assert.match(page, /employeeDirty/);
  assert.match(page, /Закрыть форму сотрудника/);
  assert.match(page, /Сотрудник сохранён, но список не обновился/);
  assert.match(page, /<option value="LABORATORY">/);
  assert.doesNotMatch(page, /<Field label="Роль"><input/);
});

test('laboratory route allows heads and has an error boundary', async () => {
  const app = await read('src/App.tsx');
  assert.match(app, /settings\/laboratory" element=\{<RoleAccess roles=\{\['ADMIN', 'HEAD', 'LABORATORY'\]\}/);
  assert.match(app, /ErrorBoundary fallbackTitle="Не удалось открыть настройки лаборатории"/);
});
