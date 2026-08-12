import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const origin = 'http://127.0.0.1:43129';
const server = setupServer();
let service: typeof import('../src/services/staffDocumentRepositoryService');

beforeAll(async () => {
  vi.stubEnv('VITE_API_URL', `${origin}/api`);
  vi.stubGlobal('localStorage', { getItem: () => null, removeItem: () => undefined, setItem: () => undefined });
  server.listen({ onUnhandledRequest: 'error' });
  service = await import('../src/services/staffDocumentRepositoryService');
});

afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('staff document repository API', () => {
  it('loads standalone documents without an order id', async () => {
    server.use(http.get(`${origin}/api/staff/documents`, ({ request }) => {
      expect(new URL(request.url).searchParams.has('orderId')).toBe(false);
      return HttpResponse.json({ data: [{
        id: 7,
        title: 'Экологическое разрешение',
        category: 'permit',
        originalFileName: 'permit.pdf',
        fileSize: 2048,
        createdAt: '2026-08-12T09:00:00Z',
        createdBy: { fullName: 'Администратор' },
        availableActions: ['DELETE'],
      }] });
    }));

    await expect(service.getStaffRepositoryDocuments()).resolves.toEqual([expect.objectContaining({
      id: '7',
      name: 'Экологическое разрешение',
      category: 'permit',
      originalFileName: 'permit.pdf',
      uploadedBy: 'Администратор',
      canDelete: true,
    })]);
  });

  it('uploads an arbitrary file directly to the repository', async () => {
    server.use(http.post(`${origin}/api/staff/documents`, async ({ request }) => {
      const form = await request.formData();
      expect(form.get('name')).toBe('Произвольный документ');
      expect(form.get('category')).toBe('other');
      expect(form.get('comment')).toBe('Без заявки');
      expect((form.get('file') as File).name).toBe('document.txt');
      return HttpResponse.json({ data: {
        id: 8,
        name: form.get('name'),
        category: form.get('category'),
        comment: form.get('comment'),
        originalFileName: 'document.txt',
      } });
    }));

    const document = await service.uploadStaffRepositoryDocument({
      file: new File(['content'], 'document.txt', { type: 'text/plain' }),
      name: 'Произвольный документ',
      category: 'other',
      comment: 'Без заявки',
    });
    expect(document).toMatchObject({ id: '8', name: 'Произвольный документ', originalFileName: 'document.txt' });
  });

  it('deletes a document by its own id', async () => {
    let called = false;
    server.use(http.delete(`${origin}/api/staff/documents/doc-9`, () => {
      called = true;
      return new HttpResponse(null, { status: 204 });
    }));
    await service.deleteStaffRepositoryDocument('doc-9');
    expect(called).toBe(true);
  });
});

