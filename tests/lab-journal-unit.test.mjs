import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import test from 'node:test';

let modulePromise;
const transpile = async (path, dependencies = {}) => {
  const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  const code = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const require = (specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected test dependency: ${specifier}`);
  };
  Function('require', 'module', 'exports', code)(require, module, module.exports);
  return module.exports;
};
const loadModule = async () => {
  if (!modulePromise) modulePromise = (async () => {
    const types = await transpile('src/types/labJournal.ts');
    const dependency = { '../../../types/labJournal': types };
    const [mappers, schemas] = await Promise.all([
      transpile('src/features/lab-journals/api/labJournalMappers.ts', dependency),
      transpile('src/features/lab-journals/schemas/journalSchemas.ts', dependency),
    ]);
    return Object.assign({}, mappers, schemas);
  })();
  return modulePromise;
};

const sampleEntryDto = {
  id: 17,
  version: 3,
  journalType: 'SAMPLE_REGISTRATION',
  laboratory: { id: 4, name: 'Испытательная лаборатория' },
  entryDate: '2026-07-21',
  registrationDate: '2026-07-21',
  executorName: 'А. Акылбек',
  data: { sampleNumber: 'ОБР-1', sampleName: 'Вода' },
  fields: { sampleNumber: 'ОБР-1' },
  createdAt: '2026-07-21T10:00:00Z',
};

test('mapJournalEntryDtoToModel keeps metadata and dynamic data through response wrappers', async () => {
  const { mapJournalEntryDtoToModel } = await loadModule();
  const entry = mapJournalEntryDtoToModel({ data: { success: true, data: sampleEntryDto } });
  assert.equal(entry.id, 17);
  assert.equal(entry.laboratoryId, 4);
  assert.equal(entry.laboratoryName, 'Испытательная лаборатория');
  assert.equal(entry.data.sampleName, 'Вода');
  assert.equal(entry.fields.sampleNumber, 'ОБР-1');
});

test('create and update mappers send data and fields, preserve zero/false and never send values', async () => {
  const { mapJournalEntryToForm, mapJournalFormToCreateRequest, mapJournalFormToUpdateRequest, mapJournalEntryDtoToModel } = await loadModule();
  const form = mapJournalEntryToForm(mapJournalEntryDtoToModel(sampleEntryDto));
  form.dynamicFields.quantity = 0;
  form.dynamicFields.accepted = false;
  form.dynamicFields.empty = '';
  const created = mapJournalFormToCreateRequest(form);
  assert.equal(created.data.quantity, 0);
  assert.equal(created.fields.accepted, false);
  assert.equal('empty' in created.data, false);
  assert.equal('values' in created, false);
  assert.equal(mapJournalFormToUpdateRequest(form).version, 3);
});

test('mapJournalEntriesResponse normalizes arrays and nested paged responses', async () => {
  const { mapJournalEntriesResponse } = await loadModule();
  const arrayPage = mapJournalEntriesResponse([sampleEntryDto]);
  assert.deepEqual({ page: arrayPage.page, size: arrayPage.size, totalElements: arrayPage.totalElements, totalPages: arrayPage.totalPages }, { page: 0, size: 1, totalElements: 1, totalPages: 1 });
  const page = mapJournalEntriesResponse({ data: { data: { content: [sampleEntryDto], number: 2, size: 10, totalElements: 25, totalPages: 3 } } });
  assert.equal(page.content.length, 1);
  assert.equal(page.page, 2);
  assert.equal(page.totalElements, 25);
});

test('validateJournalSchema is strict and does not partially accept invalid columns', async () => {
  const { validateJournalSchema } = await loadModule();
  assert.deepEqual(validateJournalSchema([{ key: 'sampleNumber', title: 'Номер', type: 'text', required: true }])[0], { key: 'sampleNumber', title: 'Номер', type: 'text', required: true, placeholder: undefined, helperText: undefined, options: undefined, min: undefined, max: undefined, step: undefined });
  assert.throws(() => validateJournalSchema([{ key: 'employee', title: 'Сотрудник', type: 'employee', required: false }]));
  assert.throws(() => validateJournalSchema([{ key: 'x', title: 'X', type: 'text', required: false }, { key: 'x', title: 'X2', type: 'text', required: false }]));
});

test('dynamic journal validation enforces dates, ranges, units and reagent balance', async () => {
  const { LOCAL_JOURNAL_SCHEMAS, validateJournalForm } = await loadModule();
  const base = { laboratoryId: 1, entryDate: '2026-07-21', registrationDate: '', preparationDate: '', executorName: '', note: '', dynamicFields: {} };
  assert.equal(validateJournalForm({ ...base, journalType: 'SAMPLE_REGISTRATION' }, LOCAL_JOURNAL_SCHEMAS.SAMPLE_REGISTRATION).registrationDate, 'Укажите дату регистрации');
  assert.equal(validateJournalForm({ ...base, journalType: 'SOLUTION_PREPARATION' }, LOCAL_JOURNAL_SCHEMAS.SOLUTION_PREPARATION).preparationDate, 'Укажите дату приготовления');
  assert.match(validateJournalForm({ ...base, journalType: 'ENVIRONMENT_CONDITIONS', dynamicFields: { temperature: 20, humidity: 101 } }, LOCAL_JOURNAL_SCHEMAS.ENVIRONMENT_CONDITIONS)['dynamicFields.humidity'], /Максимальное/);
  assert.ok(validateJournalForm({ ...base, journalType: 'TEST_RESULTS_REGISTRATION', dynamicFields: { indicatorName: 'pH', resultValue: '7' } }, LOCAL_JOURNAL_SCHEMAS.TEST_RESULTS_REGISTRATION)['dynamicFields.unit']);
  assert.match(validateJournalForm({ ...base, journalType: 'CHEMICAL_REAGENT_USAGE', dynamicFields: { reagentName: 'NaCl', initialQuantity: 2, usedQuantity: 3 } }, LOCAL_JOURNAL_SCHEMAS.CHEMICAL_REAGENT_USAGE)['dynamicFields.usedQuantity'], /превышать/);
});

test('formatJournalKeyInfo formats every supported journal type', async () => {
  const { formatJournalKeyInfo } = await loadModule();
  assert.equal(formatJournalKeyInfo({ ...sampleEntryDto, laboratoryId: 4, fields: {}, data: sampleEntryDto.data }), 'ОБР-1 · Вода');
  assert.match(formatJournalKeyInfo({ ...sampleEntryDto, laboratoryId: 4, journalType: 'ENVIRONMENT_CONDITIONS', fields: {}, data: { roomName: '101', temperature: 22, humidity: 40 } }), /101.*22.*40/);
});
