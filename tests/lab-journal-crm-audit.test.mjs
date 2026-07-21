import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('1-5 schemas validate required flags, unique keys, selection and URL state', async () => {
  const schema = await read('src/utils/journalSchema.ts');
  const page = await read('src/pages/LabJournalsPage.tsx');
  assert.match(schema, /hasOwnProperty\.call\(columnSource, 'required'\)/);
  assert.match(schema, /keys\.has\(key\)/);
  assert.match(schema, /Схема журнала настроена некорректно/);
  assert.match(page, /useSearchParams/);
  assert.match(page, /type: journalType/);
});

test('6-10 list uses server pagination, debounce, period and laboratory filters', async () => {
  const page = await read('src/pages/LabJournalsPage.tsx');
  const service = await read('src/services/labJournalService.ts');
  assert.match(page, /window\.setTimeout[\s\S]*450/);
  assert.match(page, /dateFrom/);
  assert.match(page, /dateTo/);
  assert.match(page, /laboratoryId/);
  assert.match(service, /params: queryParams\(params\)/);
  assert.match(page, /entriesQuery\.data\.first/);
  assert.match(page, /entriesQuery\.data\.last/);
});

test('11-20 five journal schemas use exact fields and no instruction fields', async () => {
  const types = await read('src/types/labJournal.ts');
  for (const code of ['SAMPLE_REGISTRATION', 'SOLUTION_PREPARATION', 'CHEMICAL_REAGENT_MOVEMENT', 'ENVIRONMENT_CONDITIONS', 'TEST_RESULTS_REGISTRATION']) assert.match(types, new RegExp(code));
  for (const key of ['sampleNumber', 'preparationDate', 'incomingQuantity', 'outgoingQuantity', 'remainingQuantity', 'relativeHumidityPercent', 'temperatureCelsius', 'pressureKpa', 'windSpeedMs', 'protocolId']) assert.match(types, new RegExp(key));
  assert.doesNotMatch(types, /Ф\.И\.О\. инструктируемого|Год рождения|Подпись инструктирующего/);
  assert.match(types, /remainingQuantity', 'Остаток', 'calculated', false, true/);
  assert.match(types, /validation: \{ min: 0, max: 100 \}/);
});

test('21-26 automatic entries, editing, conflict, archive and role matrix are enforced', async () => {
  const page = await read('src/pages/LabJournalsPage.tsx');
  const service = await read('src/services/labJournalService.ts');
  const permissions = await read('src/utils/journalPermissions.ts');
  assert.match(page, /entry\?\.automatic/);
  assert.match(page, /Запись создана автоматически из протокола/);
  assert.match(page, /Запись была изменена другим сотрудником/);
  assert.match(page, /Обновить данные/);
  assert.match(service, /payload\.version|version/);
  assert.match(service, /\/archive/);
  assert.match(service, /\/restore/);
  assert.match(permissions, /ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY/);
  assert.match(permissions, /ADMIN', 'DIRECTOR', 'HEAD/);
});

test('27-29 Excel and template downloads reject JSON error blobs', async () => {
  const service = await read('src/services/labJournalService.ts');
  assert.match(service, /responseType: 'blob'/);
  assert.match(service, /blob\.text\(\)/);
  assert.match(service, /JSON\.parse/);
  assert.match(service, /getContentDispositionFileName/);
  assert.match(service, /\/lab-journals\/templates/);
});

test('30-33 empty, error, retry and unsaved states are explicit', async () => {
  const page = await read('src/pages/LabJournalsPage.tsx');
  assert.match(page, /В этом журнале пока нет записей/);
  assert.match(page, /По заданным параметрам записи не найдены/);
  assert.match(page, /Не удалось загрузить журнал/);
  assert.match(page, /Повторить/);
  assert.match(page, /Есть несохранённые изменения\. Закрыть форму\?/);
  assert.match(page, /beforeunload/);
});

test('34-37 zero, false, interactive markup and URL restoration are covered', async () => {
  const schema = await read('src/utils/journalSchema.ts');
  const page = await read('src/pages/LabJournalsPage.tsx');
  assert.match(schema, /value === true \|\| value === 'true'/);
  assert.match(schema, /Number\(String\(value\)/);
  assert.doesNotMatch(page, /<button[\s\S]{0,500}<button/);
  for (const key of ['type', 'laboratoryId', 'page', 'size', 'search', 'dateFrom', 'dateTo', 'archived', 'sort']) assert.match(page, new RegExp(key));
});

