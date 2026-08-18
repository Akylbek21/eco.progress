import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('protocol history action opens the history tab and the filter uses current statuses', async () => {
  const page = await read('src/pages/ProtocolsPage.tsx');
  const list = await read('src/components/protocols/ProtocolList.tsx');
  const editor = await read('src/pages/ProtocolEditorPage.tsx');
  assert.match(page, /onHistory=\{\(protocol\) => navigate\(`\/staff\/protocols\/\$\{protocol\.id\}\?tab=history`\)\}/);
  assert.match(list, /onHistory\(protocol\)/);
  assert.match(editor, /get\('tab'\) === 'history' \? 'history' : 'results'/);
  const filters = page.match(/const visibleStatusFilters:[^=]+ = \[([^\]]+)\]/)?.[1] || '';
  for (const status of ['DRAFT', 'CALCULATED', 'READY_FOR_APPROVAL', 'NEEDS_REVISION', 'APPROVED', 'SIGNED', 'PUBLISHED', 'REPLACED', 'CANCELLED', 'ARCHIVED']) assert.match(filters, new RegExp(`'${status}'`));
  assert.doesNotMatch(filters, /'READY'/);
});

test('protocol lifecycle separates exceptional states and legacy wizard files are gone', async () => {
  const progress = await read('src/features/protocols/details/ProtocolProgress.tsx');
  const editor = await read('src/pages/ProtocolEditorPage.tsx');
  assert.match(progress, /\['Создан', 'Рассчитан', 'На утверждении', 'Утверждён, ожидает подписи', 'Подписан \/ завершён', 'Опубликован клиенту'\]/);
  for (const label of ['На доработке', 'Заменён', 'Отменён', 'Архив']) assert.match(progress, new RegExp(label));
  assert.match(editor, /Сохранить и рассчитать/);
  await assert.rejects(access(new URL('../src/features/protocols/components/CreateProtocolWizardModal.tsx', import.meta.url)));
  for (const file of ['protocolApi.ts', 'protocolCommands.ts', 'protocolResultsApi.ts', 'protocolWorkflowApi.ts']) {
    await assert.rejects(access(new URL(`../src/features/protocols/api/${file}`, import.meta.url)));
  }
});
