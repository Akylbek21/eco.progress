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
  assert.equal(canSearchNormative('в'), false);
  assert.equal(canSearchNormative('во'), true);
  assert.equal(canSearchNormative('вода'), true);
  assert.equal(canSearchNormative('12'), true);
  assert.equal(canSearchNormative('123'), true);
  assert.equal(canSearchNormative('CO'), true);
  assert.equal(canSearchNormative('NO2'), true);
  assert.equal(canSearchNormative('10102-44-0'), true);
});

test('protocol context maps every physical subtype and water to the required document', async () => {
  const { PROTOCOL_NORMATIVE_CONTEXT, resolveProtocolNormativeContext } = await loadTypeScriptModule('src/data/protocolNormativeContext.ts');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.ambient_air.templateId, 'ambient_air');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.ambient_air.sourceDocumentCode, 'DSM_70');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.water.sourceDocumentCode, 'DSM_138');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.lighting.factorType, 'LIGHTING');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.vibration.factorType, 'VIBRATION');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.uv.factorType, 'UV');
  assert.equal(PROTOCOL_NORMATIVE_CONTEXT.electromagnetic_field.factorType, 'ELECTROMAGNETIC_FIELD');
  assert.deepEqual(
    resolveProtocolNormativeContext('water_wastewater'),
    PROTOCOL_NORMATIVE_CONTEXT.water,
  );
  const configSource = await read('src/data/protocolTypeConfig.ts');
  assert.match(configSource, /factorType: subtype \|\| protocolFactorType\[normalizedType as ProtocolTypeKey\]/);
});

test('API service retries the canonical endpoint with relaxed filters when search returns no rows', async () => {
  const source = await read('src/services/normativeSearchService.ts');
  assert.match(source, /api\.get<unknown>\('\/normatives\/search'/);
  assert.match(source, /buildNormativeSearchSequence\(cleaned\)/);
  assert.match(source, /STRICT_ACTIVE/);
  assert.match(source, /STRICT_ALL/);
  assert.match(source, /RELAXED_ACTIVE/);
  assert.match(source, /RELAXED_ALL/);
  assert.match(source, /params: candidate\.params/);
  assert.doesNotMatch(source, /api\.get<unknown>\('\/normatives\/records'/);
  assert.doesNotMatch(source, /q: query/);
  assert.doesNotMatch(source, /code: query/);
  assert.doesNotMatch(source, /pollutantCode: query/);
  assert.doesNotMatch(source, /search: query/);
  assert.match(source, /requestedPage = params\.page \?\? 0/);
  assert.match(source, /requestedSize = params\.size \?\? 30/);
  assert.match(source, /\['items', 'content', 'normatives', 'records', 'results', 'rows'\]/);
  assert.match(source, /indicatorNameRu/);
  assert.match(source, /record\.pollutant \|\| record\.substance/);
  assert.match(source, /if \(normalized\.items\.length\) cache\.set/);
});

test('quick-create normative picker uses the shared debounced search', async () => {
  const source = await read('src/features/protocols/components/components/NormativeSelectorModal.tsx');
  assert.match(source, /protocol-normative-search-v2/);
  assert.match(source, /setDebouncedSearch\(normalizedSearch\)/);
  assert.match(source, /SEARCH_DEBOUNCE_MS = 400/);
  assert.match(source, /queryFn: \(\{ signal \}\) => searchNormatives\(request, signal\)/);
  assert.match(source, /queryClient\.cancelQueries/);
  assert.match(source, /new Map/);
  assert.match(source, /Array\.from\(selectedRecords\.values\(\)\)/);
  assert.match(source, /Поиск нормативных показателей/);
  assert.match(source, /ничего не найдено/);
  assert.match(source, /Повторить поиск/);
  assert.match(source, /Добавить показатель вручную/);
  assert.match(source, /useQuery\(/);
  assert.doesNotMatch(source, /protocolService\.searchNormative/);
});

test('hook debounces, aborts stale requests and guards responses by sequence', async () => {
  const source = await read('src/hooks/useNormativeSearch.ts');
  const service = await read('src/services/normativeSearchService.ts');
  assert.match(service, /NORMATIVE_SEARCH_DEBOUNCE_MS = 400/);
  assert.match(source, /NORMATIVE_SEARCH_DEBOUNCE_MS/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /abortRef\.current\?\.abort\(\)/);
  assert.match(source, /sequence !== sequenceRef\.current/);
  assert.match(source, /isNormativeSearchCanceled/);
});

test('creation wizard preserves the selected backend normative id', async () => {
  const source = await read('src/features/protocols/components/steps/ResultsStep.tsx');
  const mapper = await read('src/features/protocols/mappers/mapProtocolWizardToRequest.ts');
  assert.match(source, /normativeId: String\(item\.id\)/);
  assert.match(mapper, /normalizePositiveId\(row\.normativeId\)/);
  assert.match(mapper, /row\.normativeSource === 'MANUAL'/);
});

test('router keeps protocol creation inside the list wizard', async () => {
  const app = await read('src/App.tsx');
  assert.match(app, /path="\/staff\/protocols\/create"[^\n]*<Navigate to="\/staff\/protocols\?create=1" replace/);
  assert.match(app, /path="\/staff\/protocols\/new"[^\n]*<Navigate to="\/staff\/protocols\?create=1" replace/);
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
  const source = await read('src/features/protocols/utils/protocolWizardValidation.ts');
  assert.match(source, /!text\(row\.factorType\)/);
});
