import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('public order choice creates a CRM lead instead of redirecting to the client cabinet', async () => {
  const [modal, leadForm, leadService] = await Promise.all([
    read('src/components/OrderChoiceModal.tsx'),
    read('src/components/LeadForm.tsx'),
    read('src/services/leadService.ts'),
  ]);

  assert.match(modal, /<LeadForm[\s\S]*source="order_modal_site"/);
  assert.match(modal, /Оставить заявку через сайт/);
  assert.doesNotMatch(modal, /\/cabinet\/orders\/new|\/register\?redirect|useNavigate/);
  assert.match(leadForm, /await createLead\(/);
  assert.match(leadService, /api\.post<[^\n]+>\('\/leads', payload\)/);
});

test('public order choice keeps WhatsApp and provides a prefilled email request', async () => {
  const modal = await read('src/components/OrderChoiceModal.tsx');

  assert.match(modal, /createBlankWhatsAppRequestMessage/);
  assert.match(modal, /trackWhatsAppClick/);
  assert.match(modal, /mailto:\$\{company\.email\}/);
  assert.match(modal, /trackEmailClick/);
  assert.match(modal, /Отправить по email/);
});
