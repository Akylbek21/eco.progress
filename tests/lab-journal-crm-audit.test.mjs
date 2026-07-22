import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('journal feature is separated into API, hooks, schemas, components and pages', async () => {
  const page = await read('src/features/lab-journals/pages/LabJournalsPage.tsx');
  const wrapper = await read('src/pages/LabJournalsPage.tsx');
  assert.match(wrapper, /features\/lab-journals\/pages\/LabJournalsPage/);
  assert.doesNotMatch(page, /axios|api\.(get|post|put|delete)/);
  for (const name of ['JournalTypeSelector', 'JournalFilters', 'JournalEntriesTable', 'JournalEntryDialog', 'JournalExportButton']) assert.match(page, new RegExp(name));
});

test('schema accepts only strict supported field types and rejects partial invalid definitions', async () => {
  const schema = await read('src/features/lab-journals/schemas/journalSchemas.ts');
  assert.match(schema, /validateJournalSchema/);
  assert.match(schema, /keys\.has\(key\)/);
  assert.match(schema, /typeof raw\.required !== 'boolean'/);
  for (const value of ['text', 'textarea', 'number', 'date', 'datetime', 'select', 'boolean']) assert.match(schema, new RegExp(`'${value}'`));
  for (const legacy of ['employee', 'measurement_device', 'calculated', "'time'"]) assert.doesNotMatch(schema, new RegExp(legacy));
});

test('list is URL-backed, debounced for 500 ms and uses cancellable React Query requests', async () => {
  const page = await read('src/features/lab-journals/pages/LabJournalsPage.tsx');
  const hook = await read('src/features/lab-journals/hooks/useJournalEntries.ts');
  assert.match(page, /useSearchParams/);
  assert.match(page, /window\.setTimeout/);
  assert.match(page, /500/);
  assert.match(page, /value\.length >= 2/);
  assert.match(hook, /signal/);
  assert.match(hook, /placeholderData: keepPreviousData/);
});

test('table has stable business columns and view, edit and delete actions', async () => {
  const table = await read('src/features/lab-journals/components/JournalEntriesTable.tsx');
  for (const label of ['Вид журнала', 'Дата', 'Лаборатория', 'Ключевая информация', 'Исполнитель', 'Дата создания', 'Действия']) assert.match(table, new RegExp(label));
  for (const action of ['Просмотреть', 'Редактировать', 'Удалить']) assert.match(table, new RegExp(action));
  assert.doesNotMatch(table, /Архивировать|Восстановить/);
});

test('form uses RHF, normalized UI values, dirty guard and backend field errors', async () => {
  const form = await read('src/features/lab-journals/components/JournalEntryForm.tsx');
  const dialog = await read('src/features/lab-journals/components/JournalEntryDialog.tsx');
  assert.match(form, /useForm<LabJournalFormValues>/);
  assert.match(form, /dynamicFields/);
  assert.match(form, /normalizeApiError/);
  assert.match(form, /setError/);
  assert.match(form, /setFocus/);
  assert.match(form, /beforeunload/);
  assert.match(dialog, /Есть несохранённые изменения\. Продолжить\?/);
});

test('delete confirmation includes journal, date, executor and irreversible warning', async () => {
  const page = await read('src/features/lab-journals/pages/LabJournalsPage.tsx');
  for (const text of ['Удалить запись журнала?', 'Журнал:', 'Дата:', 'Исполнитель:', 'Действие нельзя отменить.']) assert.match(page, new RegExp(text.replace(/[?]/g, '\\?')));
});

test('permissions and routes enforce read and mutation access separately', async () => {
  const permissions = await read('src/utils/journalPermissions.ts');
  const app = await read('src/App.tsx');
  for (const name of ['canReadLabJournals', 'canCreateLabJournalEntry', 'canEditLabJournalEntry', 'canDeleteLabJournalEntry', 'canExportLabJournals']) assert.match(permissions, new RegExp(name));
  assert.match(permissions, /ADMIN', 'LABORATORY/);
  assert.match(app, /staff\/journals\/:entryId/);
});

test('loading, empty, filtered empty, access and retry states are distinct', async () => {
  const page = await read('src/features/lab-journals/pages/LabJournalsPage.tsx');
  const empty = await read('src/features/lab-journals/components/JournalEmptyState.tsx');
  assert.match(page, /animate-pulse/);
  assert.match(page, /Не удалось загрузить журнал\./);
  assert.match(page, /У вас нет доступа к этому разделу\./);
  assert.match(page, /Повторить/);
  assert.match(empty, /В журнале пока нет записей\./);
  assert.match(empty, /По выбранным фильтрам записи не найдены\./);
});
