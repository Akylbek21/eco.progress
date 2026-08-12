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

test('result aliases preserve testing methods, codes and scalar values', async () => {
  const { canonicalProtocolResultAliases } = await loadTypeScriptModule('src/utils/protocolResultAliases.ts');
  const normalized = canonicalProtocolResultAliases(
    { resultValue: '0.2', factorCode: 'NO2', device: 'device-1' },
    { indicatorName: 'Азота диоксид', normativeValue: '0.4', testingMethodNd: 'ГОСТ 33045-2014', samplingMethodNd: 'СТ РК 1' },
  );
  assert.deepEqual(normalized, {
    indicatorName: 'Азота диоксид',
    code: 'NO2',
    result: '0.2',
    normative: '0.4',
    testingMethodDocument: 'ГОСТ 33045-2014',
    samplingMethodDocument: 'СТ РК 1',
    measurementDeviceId: 'device-1',
  });
});

test('result aliases never put a display dash into the data model', async () => {
  const { canonicalProtocolResultAliases } = await loadTypeScriptModule('src/utils/protocolResultAliases.ts');
  assert.deepEqual(canonicalProtocolResultAliases({}, {}), {
    indicatorName: '', code: '', result: '', normative: '', testingMethodDocument: '', samplingMethodDocument: '', measurementDeviceId: '',
  });
});

test('result aliases resolve device ids from nested backend objects and values aliases', async () => {
  const { canonicalProtocolResultAliases, resolveMeasurementDeviceId } = await loadTypeScriptModule('src/utils/protocolResultAliases.ts');
  assert.equal(resolveMeasurementDeviceId({ measurementDevice: { id: 12, name: 'Gas analyzer' } }), '12');
  assert.equal(resolveMeasurementDeviceId({ device: { id: 'device-7' } }), 'device-7');
  assert.equal(resolveMeasurementDeviceId({ values: { measurementDeviceId: 'device-9' } }), 'device-9');
  assert.equal(
    canonicalProtocolResultAliases({ measurementDevice: { id: 23 } }, {}).measurementDeviceId,
    '23',
  );
});

test('protocol permission matrix is backend-authoritative and immutable-safe', async () => {
  const source = await read('src/utils/protocolPermissions.ts');
  assert.match(source, /protocol\?\.permissions/);
  assert.match(source, /availableActions/);
  assert.match(source, /flag\('canEdit'\)/);
  assert.match(source, /canReadyForApproval: hasProtocolAction\(protocol \|\| undefined, 'COMPLETE'\)/);
  assert.match(source, /canReplace: flag\('canCreateCorrection'\)/);
  assert.match(source, /canApprove: hasProtocolAction\(protocol \|\| undefined, 'APPROVE'\)/);
  assert.match(source, /canSign: hasProtocolAction\(protocol \|\| undefined, 'SIGN'\)/);
  assert.match(source, /backend\?\.\[key\] === true/);
});

test('protocol normative display keeps zero values', async () => {
  const { protocolNormativeDisplayValue } = await loadTypeScriptModule('src/utils/protocolNormativeSearch.ts');
  assert.equal(protocolNormativeDisplayValue({ value: 0 }), '0');
  assert.equal(protocolNormativeDisplayValue({ min: 0, max: 10 }), '0-10');
});

test('protocol normative display helpers do not filter or rerank server search results', async () => {
  const source = await read('src/utils/protocolNormativeSearch.ts');
  assert.doesNotMatch(source, /tokens\.every|filterAndRankProtocolNormatives|matchesProtocolNormativeContext|queryScore/);
});
