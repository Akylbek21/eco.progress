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
  for (const status of ['DRAFT', 'CALCULATED', 'READY_FOR_APPROVAL', 'NEEDS_REVISION', 'APPROVED', 'SIGNED', 'REPLACED', 'CANCELLED', 'ARCHIVED']) assert.match(filters, new RegExp(`'${status}'`));
  assert.doesNotMatch(filters, /'READY'|'PUBLISHED'/);
  assert.match(page, /published: params\.get\('published'\)/);
});

test('protocol lifecycle separates exceptional states and legacy UI files are gone', async () => {
  const progress = await read('src/features/protocols/details/ProtocolProgress.tsx');
  const editor = await read('src/pages/ProtocolEditorPage.tsx');
  assert.match(progress, /\['Создан', 'Рассчитан', 'На утверждении', 'Утверждён, ожидает подписи', 'Подписан \/ завершён'\]/);
  assert.doesNotMatch(progress, /Опубликован клиенту/);
  for (const label of ['На доработке', 'Заменён', 'Отменён', 'Архив']) assert.match(progress, new RegExp(label));
  assert.match(editor, /Сохранить и рассчитать/);
  await access(new URL('../src/features/protocols/components/CreateProtocolWizardModalV2.tsx', import.meta.url));
  for (const file of [
    'src/features/protocols/components/CreateProtocolWizardModal.tsx',
    'src/components/protocols/CreateProtocolModal.tsx',
    'src/components/protocols/ProtocolActionsBar.tsx',
    'src/features/protocols/mappers/mapFormToCreateProtocolRequest.ts',
  ]) await assert.rejects(access(new URL(`../${file}`, import.meta.url)));
  for (const file of ['protocolApi.ts', 'protocolCommands.ts', 'protocolResultsApi.ts', 'protocolWorkflowApi.ts']) {
    await assert.rejects(access(new URL(`../src/features/protocols/api/${file}`, import.meta.url)));
  }
});

test('protocols use only V2 creation and canonical backend actions UI', async () => {
  const page = await read('src/pages/ProtocolsPage.tsx');
  const header = await read('src/features/protocols/details/ProtocolHeader.tsx');
  const menu = await read('src/features/protocols/details/ProtocolActionsMenu.tsx');
  const details = await read('src/features/protocols/details/ProtocolDetailsView.tsx');
  const documents = await read('src/features/protocols/details/ProtocolDocumentsTab.tsx');
  const types = await read('src/types/protocols.ts');
  const badge = await read('src/components/protocols/ProtocolStatusBadge.tsx');

  assert.match(page, /import CreateProtocolWizardModalV2/);
  assert.match(page, /<CreateProtocolWizardModalV2/);
  assert.doesNotMatch(page, /CreateProtocolModal|CreateProtocolWizardModal['"]/);
  assert.doesNotMatch(page, /quickCreateProtocol|quick-create/);
  assert.match(header, /<ProtocolActionsMenu/);
  for (const action of ['returnToDraft', 'createCorrection', 'viewAudit', 'generateDocx', 'generatePdf', 'regenerateDocx', 'regeneratePdf']) {
    assert.match(menu + details + documents, new RegExp(`actions\\.${action}`));
  }
  assert.match(details, /actions\.viewAudit \? baseTabs/);
  assert.match(documents, /protocol\.hasPdf && actions\.regeneratePdf/);
  assert.match(documents, /protocol\.hasDocx && actions\.regenerateDocx/);
  assert.doesNotMatch(types, /\|\s*'READY'|\|\s*'PUBLISHED'/);
  assert.match(badge, /normalized === 'SIGNED' && publishedAt \? 'Опубликован'/);
});
