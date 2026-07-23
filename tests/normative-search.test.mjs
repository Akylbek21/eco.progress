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
  assert.equal(canSearchNormative('12'), true);
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
  const configSource = await read('src/data/protocolTypeConfig.ts');
  assert.match(configSource, /factorType: subtype \|\| protocolFactorType\[normalizedType as ProtocolTypeKey\]/);
});

test('API service falls back to the normative directory when search returns no rows', async () => {
  const source = await read('src/services/normativeSearchService.ts');
  assert.match(source, /api\.get<unknown>\('\/normatives\/search'/);
  assert.match(source, /if \(!normalized\.items\.length\)/);
  assert.match(source, /api\.get<unknown>\('\/normatives\/records'/);
  assert.match(source, /search: query/);
  assert.match(source, /q: query/);
  assert.match(source, /code: query/);
  assert.match(source, /pollutantCode: query/);
  assert.match(source, /requestedPage = params\.page \?\? 0/);
  assert.match(source, /requestedSize = params\.size \?\? 30/);
  assert.match(source, /\['items', 'content', 'normatives', 'records', 'results', 'rows'\]/);
  assert.match(source, /indicatorNameRu/);
  assert.match(source, /record\.pollutant \|\| record\.substance/);
  assert.match(source, /if \(normalized\.items\.length\) cache\.set/);
});

test('hook debounces, aborts stale requests and guards responses by sequence', async () => {
  const source = await read('src/hooks/useNormativeSearch.ts');
  const service = await read('src/services/normativeSearchService.ts');
  assert.match(service, /NORMATIVE_SEARCH_DEBOUNCE_MS = 450/);
  assert.match(source, /NORMATIVE_SEARCH_DEBOUNCE_MS/);
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
  assert.doesNotMatch(source, /templateKey === 'uv_emf_laser'/);
  assert.match(source, /current\.map\(\(item\) => item\.selectedNormative \|\| item\.normative/);
  assert.match(source, /normative: undefined, selectedNormative: undefined, normativeId: undefined/);
  assert.doesNotMatch(source, /current\.filter\(\(item\) => !item\.selectedNormative\)/);
  assert.match(source, /previous\.compatibility !== indicatorCompatibilityKey/);
  assert.match(source, /setSelectedIndicators\(\[\]\)/);
  assert.match(source, /Выбранные показатели очищены/);
  assert.match(source, /retryNormativeSearch/);
  assert.match(source, /searchDone && !searchError/);
});

test('router keeps protocol creation inside the list wizard', async () => {
  const app = await read('src/App.tsx');
  assert.match(app, /path="\/staff\/protocols\/create"[^\n]*<Navigate to="\/staff\/protocols" replace/);
  assert.match(app, /path="\/staff\/protocols\/new"[^\n]*<Navigate to="\/staff\/protocols" replace/);
  assert.match(app, /path="\/staff\/protocols\/:protocolId"[\s\S]*<ProtocolEditorPage/);
});

test('protocol editor uses the shared single-request normative search', async () => {
  const source = await read('src/components/protocols/ProtocolResultsTable.tsx');
  assert.match(source, /getNormativesForProtocol\(buildNormativeSearchParams\(value, page\), controller\.signal\)/);
  assert.match(source, /size: 20/);
  assert.match(source, /normativeRecordId: normative\.id/);
  assert.match(source, /подтверждённой backend-конвертации/);
  assert.match(source, /categoryCode: searchContext\.categoryCode/);
  assert.match(source, /NORMATIVE_SEARCH_DEBOUNCE_MS/);
  assert.match(source, /canSearchNormative\(value\)/);
  assert.doesNotMatch(source, /protocolService\.searchNormative|fallbackParams|candidateScore|matchesProtocolNormative/);
});

test('physical factor validation requires factor type but not a universal factor code', async () => {
  const source = await read('src/pages/ProtocolCreatePage.tsx');
  assert.match(source, /measurements\.find\(\(item\) => !item\.factorType\)/);
  assert.doesNotMatch(source, /!item\.factorType \|\| !item\.factorCode/);
  assert.match(source, /const invalidPollutant = isPhysical\s*\? undefined/);
});
