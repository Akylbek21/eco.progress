// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { signatureDocumentService } from '../src/services/signatureDocumentService';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('staff signature documents', () => {
  it('uses only the new /staff/signature-documents API contract', async () => {
    const requests: Array<{ method: string; path: string; body?: unknown }> = [];
    server.use(
      http.get('*/api/staff/signature-documents', ({ request }) => {
        requests.push({ method: request.method, path: new URL(request.url).pathname });
        return HttpResponse.json({ data: { items: [{ id: 7, name: 'Акт', fileName: 'act.pdf', status: 'UPLOADED', version: 3, createdAt: '2026-08-12T10:00:00Z' }] } });
      }),
      http.post('*/api/staff/signature-documents/:id/prepare-signing', async ({ request }) => {
        requests.push({ method: request.method, path: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json({ data: { signingSessionId: 'session-1', documentId: 7, version: 3, sha256: 'abc' } });
      }),
      http.post('*/api/staff/signature-documents/:id/sign', async ({ request }) => {
        requests.push({ method: request.method, path: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json({ success: true });
      }),
    );

    const [document] = await signatureDocumentService.list();
    expect(document.status).toBe('UNSIGNED');
    const prepared = await signatureDocumentService.prepareSigning(document);
    await signatureDocumentService.submitSignature({ ...prepared, cmsBase64: 'cms' });

    expect(requests).toEqual([
      { method: 'GET', path: '/api/staff/signature-documents' },
      { method: 'POST', path: '/api/staff/signature-documents/7/prepare-signing', body: { version: 3 } },
      { method: 'POST', path: '/api/staff/signature-documents/7/sign', body: { signingSessionId: 'session-1', documentId: '7', version: 3, sha256: 'abc', cmsBase64: 'cms' } },
    ]);
  });

  it('uploads multipart and exposes original and signed-package downloads', async () => {
    const seen: string[] = [];
    server.use(
      http.post('*/api/staff/signature-documents', async ({ request }) => {
        const form = await request.formData();
        seen.push(`${form.get('name')}:${Boolean(form.get('file'))}`);
        return HttpResponse.json({ data: { id: 9, name: 'Приказ', fileName: 'order.pdf', status: 'SIGNED', version: 1 } });
      }),
    );
    const document = await signatureDocumentService.upload(new File(['pdf'], 'order.pdf', { type: 'application/pdf' }), 'Приказ');
    expect(document.status).toBe('SIGNED');
    expect(seen).toEqual(['Приказ:true']);
    const service = readFileSync(resolve(process.cwd(), 'src/services/signatureDocumentService.ts'), 'utf8');
    expect(service).toContain("`${BASE_PATH}/${prepared.documentId}/content`");
    expect(service).toContain("`${BASE_PATH}/${document.id}/original`");
    expect(service).toContain("`${BASE_PATH}/${document.id}/signed-package`");
  });

  it('wires one internal page, removes legacy navigation, and includes employee IIN', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const staff = readFileSync(resolve(process.cwd(), 'src/layouts/StaffLayout.tsx'), 'utf8');
    const publicLayout = readFileSync(resolve(process.cwd(), 'src/layouts/PublicLayout.tsx'), 'utf8');
    const cabinet = readFileSync(resolve(process.cwd(), 'src/layouts/CabinetLayout.tsx'), 'utf8');
    const admin = readFileSync(resolve(process.cwd(), 'src/layouts/AdminLayout.tsx'), 'utf8');
    const users = readFileSync(resolve(process.cwd(), 'src/pages/AdminUsersPage.tsx'), 'utf8');
    expect(app).toContain('<StaffLayout><SignatureDocumentsPage /></StaffLayout>');
    expect(app).not.toContain('DocumentFlowRoutes');
    expect(app).not.toContain('ExternalDocumentSigningPage');
    expect(staff).toContain("label: 'Подписание документов'");
    expect(publicLayout + cabinet + admin).not.toContain('/document-flow');
    expect(users).toContain('field="iin" label="ИИН сотрудника"');
    expect(users).toContain('iin: staffForm.iin.trim()');
  });
});
