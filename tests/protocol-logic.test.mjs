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

test('protocol normative search accepts short valid indicators and keeps zero values', async () => {
  const {
    canSearchProtocolNormative,
    protocolNormativeDisplayValue,
  } = await loadTypeScriptModule('src/utils/protocolNormativeSearch.ts');
  assert.equal(canSearchProtocolNormative('pH'), true);
  assert.equal(canSearchProtocolNormative('7.1'), true);
  assert.equal(canSearchProtocolNormative('x'), false);
  assert.equal(protocolNormativeDisplayValue({ value: 0 }), '0');
  assert.equal(protocolNormativeDisplayValue({ min: 0, max: 10 }), '0-10');
});

test('protocol normative search preserves condition variants and ranks selected context first', async () => {
  const { filterAndRankProtocolNormatives } = await loadTypeScriptModule('src/utils/protocolNormativeSearch.ts');
  const base = {
    templateId: 'microclimate',
    sourceDocumentCode: 'DSM_15',
    factorType: 'MICROCLIMATE',
    factorCode: 'TEMP_AIR',
    indicator: 'Air temperature',
    active: true,
    archived: false,
  };
  const warm = { ...base, id: 'warm', season: 'WARM', workCategory: 'IA', value: '25' };
  const cold = { ...base, id: 'cold', season: 'COLD', workCategory: 'IA', value: '22' };
  const result = filterAndRankProtocolNormatives([warm, cold], 'temperature', {
    templateId: 'microclimate',
    sourceDocumentCode: 'DSM_15',
    factorType: 'MICROCLIMATE',
    season: 'COLD',
    workCategory: 'IA',
  });
  assert.deepEqual(result.map((item) => item.id), ['cold', 'warm']);
});

test('protocol normative search accepts legacy template aliases without leaking other documents', async () => {
  const { filterAndRankProtocolNormatives } = await loadTypeScriptModule('src/utils/protocolNormativeSearch.ts');
  const physical = {
    id: 'physical', templateId: 'physical_factors', sourceDocumentCode: 'DSM_15',
    factorType: 'MICROCLIMATE', factorCode: 'TEMP_AIR', indicator: 'Temperature', active: true,
  };
  const wrongDocument = { ...physical, id: 'wrong', sourceDocumentCode: 'DSM_70' };
  const result = filterAndRankProtocolNormatives([physical, wrongDocument], 'temp', {
    templateId: 'microclimate', sourceDocumentCode: 'DSM_15', factorType: 'MICROCLIMATE',
  });
  assert.deepEqual(result.map((item) => item.id), ['physical']);
});
