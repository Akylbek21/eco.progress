import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  canDeleteDocument,
  canRespondToAgreement,
  canSignContract,
  canUploadDocument,
  getDocumentStatusLabel,
  normalizeAgreementStatus,
  normalizeClientPaymentStatus,
  normalizeDocumentStatus,
} from '../src/utils/clientWorkflow.ts';

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('client opens only the scoped order details endpoint and has 403/404 states', async () => {
  const [service, page] = await Promise.all([read('src/services/clientOrderService.ts'), read('src/pages/CabinetPages.tsx')]);
  assert.match(service, /\/client\/orders\/\$\{orderId\}/);
  assert.match(page, /loadError\.status === 403/);
  assert.match(page, /loadError\.status === 404/);
});

test('primary document lifecycle uses stable backend status codes', () => {
  assert.equal(normalizeDocumentStatus('need_upload'), 'NEED_UPLOAD');
  assert.equal(normalizeDocumentStatus('under_review'), 'IN_REVIEW');
  assert.equal(normalizeDocumentStatus('needs_fix'), 'REVISION_REQUESTED');
  assert.equal(normalizeDocumentStatus('accepted'), 'APPROVED');
  assert.equal(getDocumentStatusLabel('APPROVED'), 'Принят');
});

test('approved document cannot be replaced and revision can be uploaded', () => {
  assert.equal(canUploadDocument('APPROVED'), false);
  assert.equal(canUploadDocument('IN_REVIEW'), false);
  assert.equal(canUploadDocument('REVISION_REQUESTED'), true);
});

test('document can only be deleted before review', () => {
  assert.equal(canDeleteDocument('UPLOADED'), true);
  assert.equal(canDeleteDocument('IN_REVIEW'), false);
});

test('protected download uses axios blob and always revokes object URL', async () => {
  const service = await read('src/services/clientDocumentService.ts');
  assert.match(service, /responseType: 'blob'/);
  assert.match(service, /URL\.createObjectURL\(blob\)/);
  assert.match(service, /finally\s*\{[\s\S]*URL\.revokeObjectURL\(url\)/);
  assert.doesNotMatch(service, /\/api\/files\/documents/);
});

test('contract signing downloads bytes, calls NCALayer and posts CMS DTO', async () => {
  const service = await read('src/services/clientContractService.ts');
  assert.match(service, /getClientDocumentBlob/);
  assert.match(service, /signBase64WithNCALayer/);
  assert.match(service, /documentId, cms: signedCms, certificateInfo/);
  assert.match(service, /\/contract\/sign/);
  assert.equal(canSignContract('SENT_TO_CLIENT'), true);
  assert.equal(canSignContract('SIGNED'), false);
});

test('signed PDF uses its dedicated multipart endpoint', async () => {
  const service = await read('src/services/clientContractService.ts');
  assert.match(service, /\/contract\/upload-signed/);
  assert.match(service, /formData\.append\('file', file\)/);
  assert.doesNotMatch(service, /formData\.append\('type', 'contract'\)/);
});

test('payment receipt sends full payment metadata and never marks payment paid', async () => {
  const service = await read('src/services/clientPaymentService.ts');
  for (const field of ['amount', 'paymentDate', 'paymentMethod', 'paymentOrderNumber', 'comment', 'file']) assert.match(service, new RegExp(`formData\\.append\\('${field}'`));
  assert.match(service, /\/payments\/receipts/);
  assert.equal(normalizeClientPaymentStatus('receipt_uploaded'), 'RECEIPT_UPLOADED');
  assert.doesNotMatch(service, /'PAID'/);
});

test('agreement requires document review and stable response codes', async () => {
  const modal = await read('src/components/modals/AgreementResponseModal.tsx');
  assert.match(modal, /Сначала скачайте и ознакомьтесь/);
  assert.match(modal, /REVISION_REQUESTED/);
  assert.match(modal, /SIGNED/);
  assert.equal(canRespondToAgreement('PENDING'), true);
  assert.equal(canRespondToAgreement('ACCEPTED'), false);
  assert.equal(normalizeAgreementStatus('accepted'), 'ACCEPTED');
});

test('measurement confirmation and reschedule use one DTO with mandatory reason', async () => {
  const service = await read('src/services/clientLaboratoryService.ts');
  assert.match(service, /'RESCHEDULE_REQUESTED' : 'ACCEPTED'/);
  assert.match(service, /!payload\.rescheduleDate \|\| !payload\.rescheduleTime \|\| !payload\.comment/);
  assert.doesNotMatch(service, /measurementDate:\s*payload|date:\s*payload/);
});

test('laboratory results are shown only when published for client', async () => {
  const adapter = await read('src/services/backendAdapters.ts');
  assert.match(adapter, /document\.clientVisible === true/);
  assert.match(adapter, /PUBLISHED_TO_CLIENT/);
});

test('internal documents are filtered from client data', async () => {
  const adapter = await read('src/services/backendAdapters.ts');
  assert.match(adapter, /doc\.type !== 'internal'/);
  assert.match(adapter, /!== 'INTERNAL'/);
});

test('generic client upload exposes no system categories', async () => {
  const [service, page] = await Promise.all([read('src/services/clientDocumentService.ts'), read('src/pages/CabinetPages.tsx')]);
  for (const category of ['CLIENT_DOCUMENT', 'SUPPORTING_DOCUMENT', 'OTHER_CLIENT_DOCUMENT']) assert.match(service, new RegExp(category));
  assert.match(page, /categories=\{\['CLIENT_DOCUMENT', 'SUPPORTING_DOCUMENT', 'OTHER_CLIENT_DOCUMENT'\]\}/);
  assert.doesNotMatch(page, /categories=\{\['client_data', 'invoice', 'act', 'protocol'/);
});

test('annual quarter upload is fixed to QUARTER_CLIENT_DATA', async () => {
  const page = await read('src/pages/CabinetPages.tsx');
  assert.match(page, /categories=\{\['QUARTER_CLIENT_DATA'\]\}/);
});

test('empty states exist for documents, laboratory results and timeline', async () => {
  const page = await read('src/pages/CabinetPages.tsx');
  for (const text of ['Документы пока не загружены', 'Опубликованных результатов пока нет', 'История пока пуста']) assert.match(page, new RegExp(text));
});
