import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const loadTypeScriptModule = async (relativePath) => {
  const source = await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
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

test('protocol permission matrix restricts destructive and signing actions', async () => {
  const { getProtocolPermissions, normalizeProtocolStatus } = await loadTypeScriptModule('src/utils/protocolPermissions.ts');
  assert.equal(normalizeProtocolStatus(' signed '), 'SIGNED');
  assert.equal(getProtocolPermissions('DRAFT', 'LABORATORY').canSave, true);
  assert.equal(getProtocolPermissions('DRAFT', 'LABORATORY').canDelete, false);
  assert.equal(getProtocolPermissions('DRAFT', 'ADMIN').canDelete, true);
  assert.equal(getProtocolPermissions('APPROVED', 'LABORATORY').canSign, false);
  assert.equal(getProtocolPermissions('APPROVED', 'HEAD').canSign, true);
  assert.equal(getProtocolPermissions('SIGNED', 'HEAD').canCreateCorrection, true);
});
