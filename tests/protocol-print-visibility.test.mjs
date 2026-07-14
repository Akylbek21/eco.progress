import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const loadTypeScriptModule = async (relativePath) => {
  const source = await read(relativePath);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
};

test('visibility defaults to visible and can be hidden without changing field data', async () => {
  const { isProtocolFieldVisible, setProtocolFieldVisibility } = await loadTypeScriptModule('src/utils/protocolPrintVisibility.ts');
  const protocolData = { organizationName: 'ТОО Эко', printVisibility: {} };
  const printVisibility = setProtocolFieldVisibility(protocolData.printVisibility, 'organizationName', false);
  assert.equal(protocolData.organizationName, 'ТОО Эко');
  assert.equal(isProtocolFieldVisible(printVisibility, 'organizationName'), false);
  assert.equal(isProtocolFieldVisible(printVisibility, 'organizationAddress'), true);
  assert.equal(isProtocolFieldVisible(setProtocolFieldVisibility(printVisibility, 'organizationName', true), 'organizationName'), true);
});

test('visibility normalizer restores booleans from API objects and JSON', async () => {
  const { normalizeProtocolPrintVisibility } = await loadTypeScriptModule('src/utils/protocolPrintVisibility.ts');
  assert.deepEqual(normalizeProtocolPrintVisibility({ temperature: false, humidity: true, unknown: false }), { temperature: false, humidity: true });
  assert.deepEqual(normalizeProtocolPrintVisibility('{"testingPurpose":false}'), { testingPurpose: false });
});

test('all requested protocol fields have visibility controls', async () => {
  const sources = await Promise.all([
    read('src/components/protocols/ProtocolOrganizationForm.tsx'),
    read('src/components/protocols/ProtocolTestingForm.tsx'),
    read('src/components/protocols/ProtocolEnvironmentForm.tsx'),
    read('src/pages/ProtocolCreatePage.tsx'),
  ]);
  const source = sources.join('\n');
  for (const field of [
    'organizationName', 'organizationAddress', 'objectName', 'productName', 'testingBasis',
    'samplingDate', 'testingStartDate', 'testingEndDate', 'productNormativeDocument',
    'samplingMethodDocument', 'testingMethodDocument', 'testingPurpose', 'measurementPlace',
    'measurementDate', 'environmentConditions', 'temperature', 'humidity', 'pressureKpa', 'windSpeed',
  ]) {
    assert.match(source, new RegExp(`field=["']${field}["']`), `missing control for ${field}`);
  }
});

test('checkbox changes only print visibility and does not disable the associated value', async () => {
  const source = await read('src/components/protocols/ProtocolPrintVisibilityToggle.tsx');
  assert.match(source, /setProtocolFieldsVisibility/);
  assert.doesNotMatch(source, /setValue|organizationName:\s*['"]{2}|onChange\(\{.*value/);
  const organizationForm = await read('src/components/protocols/ProtocolOrganizationForm.tsx');
  assert.doesNotMatch(organizationForm, /disabled=\{[^}]*printVisibility/);
});

test('API persists print visibility and preview filters hidden fields', async () => {
  const service = await read('src/services/apiProtocolService.ts');
  const preview = await read('src/components/protocols/ProtocolPreviewModal.tsx');
  assert.match(service, /printVisibility: payload\.printVisibility \|\| \{\}/);
  assert.match(service, /normalizeProtocolPrintVisibility/);
  assert.match(preview, /isProtocolFieldVisible/);
  assert.match(preview, /visible\('environmentConditions'\) && environmentFields\.length > 0/);
  assert.match(preview, /visible\(field\) && content !== undefined/);
});

test('wind speed is controlled and manual input is not overwritten by weather API', async () => {
  const createPage = await read('src/pages/ProtocolCreatePage.tsx');
  const environmentForm = await read('src/components/protocols/ProtocolEnvironmentForm.tsx');
  assert.match(createPage, /manuallyEditedWeatherRef\.current\.has\('windSpeed'\)/);
  assert.match(createPage, /manuallyEditedWeatherRef\.current\.add\('windSpeed'\)/);
  assert.match(createPage, /type="number" min="0" max="100" step="0\.1" value=\{form\.windSpeed\}/);
  assert.match(environmentForm, /value=\{value\.windSpeed \?\? ''\}/);
  assert.match(environmentForm, /onChange=\{\(event\) => updateWindSpeed\(event\.target\.value\)\}/);
  assert.match(environmentForm, /windSpeed: windSpeed\.replace\(',', '\.'\),\s*status: 'MANUAL'/);
  assert.match(environmentForm, /manualChangeReason/);
  const editableWindStart = environmentForm.indexOf('? <input type="number" min="0" max="100" step="0.1"');
  const editableWindEnd = environmentForm.indexOf(': <input readOnly', editableWindStart);
  const editableWindInput = editableWindStart >= 0 && editableWindEnd > editableWindStart
    ? environmentForm.slice(editableWindStart, editableWindEnd)
    : '';
  assert.ok(editableWindInput);
  assert.doesNotMatch(editableWindInput, /<input[^>]*(?:disabled|readOnly)/);
});
