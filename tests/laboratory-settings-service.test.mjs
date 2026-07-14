import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('laboratory reads use supported settings and collection endpoints', async () => {
  const source = await read('src/services/laboratorySettingsService.ts');
  assert.match(source, /getLaboratory\(id:[\s\S]*return getLaboratorySettings\(id\)/);
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

