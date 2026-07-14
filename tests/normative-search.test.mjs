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

test('search threshold supports regular queries, formulas and CAS', async () => {
  const { canSearchNormative } = await loadTypeScriptModule('src/utils/normativeSearchRules.ts');
  assert.equal(canSearchNormative(undefined), false);
  assert.equal(canSearchNormative(null), false);
  assert.equal(canSearchNormative(''), false);
  assert.equal(canSearchNormative('во'), false);
  assert.equal(canSearchNormative('вода'), true);
  assert.equal(canSearchNormative('12'), false);
  assert.equal(canSearchNormative('123'), true);
  assert.equal(canSearchNormative('CO'), true);
  assert.equal(canSearchNormative('NO2'), true);
  assert.equal(canSearchNormative('10102-44-0'), true);
});

test('protocol context maps every physical subtype and water to the required document', async () => {
  const { PROTOCOL_NORMATIVE_CONTEXT } = await loadTypeScriptModule('src/data/protocolNormativeContext.ts');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.ambient_air.templateId, 'ambient_air');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.ambient_air.sourceDocumentCode, 'DSM_70');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.water.sourceDocumentCode, 'DSM_138');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.lighting.factorType, 'LIGHTING');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.vibration.factorType, 'VIBRATION');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.uv.factorType, 'UV');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.electromagnetic_field.factorType, 'ELECTROMAGNETIC_FIELD');
});

test('API service uses only normative search and requests one page', async () => {
  const source = await read('src/services/normativeSearchService.ts');
  assert.match(source, /api\.get<unknown>\('\/normatives\/search'/);
  assert.doesNotMatch(source, /\/normatives\/records/);
  assert.match(source, /requestedPage = params\.page \?\? 0/);
  assert.match(source, /requestedSize = params\.size \?\? 30/);
  assert.match(source, /\['items', 'content', 'normatives', 'records', 'results', 'rows'\]/);
  assert.match(source, /indicatorNameRu/);
  assert.match(source, /record\.pollutant \|\| record\.substance/);
  assert.match(source, /if \(normalized\.items\.length\) cache\.set/);
});

test('hook debounces, aborts stale requests and guards responses by sequence', async () => {
  const source = await read('src/hooks/useNormativeSearch.ts');
  assert.match(source, /SEARCH_DEBOUNCE_MS = 450/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /abortRef\.current\?\.abort\(\)/);
  assert.match(source, /sequence !== sequenceRef\.current/);
  assert.match(source, /isNormativeSearchCanceled/);
});

test('creation page preserves server items and the complete selected normative', async () => {
  const source = await read('src/pages/ProtocolCreatePage.tsx');
  assert.match(source, /normativeItems\.map\(normalizeNormativeIndicator\)/);
  assert.doesNotMatch(source, /filterAndRankProtocolNormatives|tokens\.every|getAllNormativeRecords/);
  assert.match(source, /selectedNormative: item/);
  assert.match(source, /String\(selectedNormative\.id\)/);
  assert.match(source, /value: 'VIBRATION'/);
  assert.match(source, /value: 'ELECTROMAGNETIC_FIELD'/);
  assert.match(source, /value: 'LASER'/);
  assert.match(source, /current\.filter\(\(item\) => !item\.selectedNormative\)/);
  assert.match(source, /retryNormativeSearch/);
  assert.match(source, /searchDone && !searchError/);
});
