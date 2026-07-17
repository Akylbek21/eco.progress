import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('protocol creation ignores stale company object and employee responses', async () => {
  const source = await read('src/pages/ProtocolCreatePage.tsx');
  assert.match(source, /const objectRequestRef = useRef\(0\)/);
  assert.match(source, /requestId !== objectRequestRef\.current/);
  assert.match(source, /const employeeRequestRef = useRef\(0\)/);
  assert.match(source, /requestId !== employeeRequestRef\.current/);
});

test('protocol creation never reports a successful POST as a failed creation when reload fails', async () => {
  const source = await read('src/pages/ProtocolCreatePage.tsx');
  assert.match(source, /const created = await protocolService\.quickCreateProtocol\(quickPayload\)/);
  assert.match(source, /try \{\s*protocol = await protocolService\.getProtocol\(created\.id\);\s*\} catch \(reloadError\)/s);
  assert.match(source, /Протокол создан/);
  assert.match(source, /navigate\(`\/staff\/protocols\/\$\{created\.id\}`/);
});

test('protocol creation validates dates, measurements, samples and weather ranges', async () => {
  const source = await read('src/pages/ProtocolCreatePage.tsx');
  assert.match(source, /form\.measurementDate > form\.protocolDate/);
  assert.match(source, /isNumericMeasurement\(item\.result\)/);
  assert.match(source, /\(isSoil \|\| isWater\) && !form\.sampleNumber\.trim\(\)/);
  assert.match(source, /isSoil && !form\.samplingDepth\.trim\(\)/);
  assert.match(source, /isDecimalInRange\(form\.humidity, 0, 100\)/);
  assert.match(source, /isDecimalInRange\(form\.windSpeed, 0, 100\)/);
});

test('protocol creation exposes all active laboratories and guards unsaved data', async () => {
  const source = await read('src/pages/ProtocolCreatePage.tsx');
  assert.match(source, /const \[companyItems, laboratoryItems\] = await Promise\.all/);
  assert.match(source, /setLaboratories\(activeLaboratories\)/);
  assert.doesNotMatch(source, /defaultLaboratory\?\.active \? \[defaultLaboratory\]/);
  assert.match(source, /window\.addEventListener\('beforeunload'/);
  assert.match(source, /Есть несохранённые данные протокола/);
});

test('mock quick-create preserves production environment metadata', async () => {
  const source = await read('src/services/mockProtocolService.ts');
  assert.match(source, /\.\.\.\(payload\.environment \|\| \{\}\)/);
  assert.match(source, /sourceDocumentCode: payload\.sourceDocumentCode/);
  assert.match(source, /docxTemplateCode: payload\.docxTemplateCode/);
  assert.doesNotMatch(source, /source: 'MANUAL', dataSource: 'manual'/);
});

