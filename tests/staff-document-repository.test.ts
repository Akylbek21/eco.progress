import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const origin = 'http://127.0.0.1:43129';
const server = setupServer();
let service: typeof import('../src/services/staffDocumentRepositoryService');
let api: typeof import('../src/services/api').default;

beforeAll(async () => {
  vi.stubEnv('VITE_API_URL', `${origin}/api`);
  vi.stubGlobal('localStorage', { getItem: () => null, removeItem: () => undefined, setItem: () => undefined });
  server.listen({ onUnhandledRequest: 'error' });
  api = (await import('../src/services/api')).default;
  service = await import('../src/services/staffDocumentRepositoryService');
});

afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('staff document repository API', () => {
  it('passes search, filters, sort and pagination to backend and reads page metadata', async () => {
    server.use(http.get(`${origin}/api/staff/documents`, ({ request }) => {
      expect(Object.fromEntries(new URL(request.url).searchParams)).toEqual({
        q: 'permit', category: 'permit', uploadedByUserId: '42', dateFrom: '2026-08-01',
        dateTo: '2026-08-13', page: '2', size: '10', sort: 'name,asc',
      });
      return HttpResponse.json({ data: {
        content: [{
          id: 7,
          title: 'Экологическое разрешение',
          category: 'permit',
          originalFileName: 'permit.pdf',
          fileSize: 2048,
          createdAt: '2026-08-12T09:00:00Z',
          createdBy: { fullName: 'Администратор' },
          availableActions: ['DELETE'],
        }],
        number: 2,
        size: 10,
        totalElements: 31,
        totalPages: 4,
      } });
    }));

    await expect(service.getStaffRepositoryDocuments({
      q: ' permit ', category: 'permit', uploadedByUserId: '42', dateFrom: '2026-08-01',
      dateTo: '2026-08-13', page: 2, size: 10, sort: 'name,asc',
    })).resolves.toEqual({
      items: [expect.objectContaining({ id: '7', category: 'permit', originalFileName: 'permit.pdf', canDelete: true })],
      page: 2,
      size: 10,
      totalElements: 31,
      totalPages: 4,
    });
  });

  it('downloads content through the authorized API client as a blob', async () => {
    const content = new Blob(['document'], { type: 'application/pdf' });
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: content } as never);

    const result = await service.downloadStaffRepositoryDocument('doc-7');
    expect(get).toHaveBeenCalledWith('/staff/documents/doc-7/download', { responseType: 'blob' });
    expect(result).toBe(content);
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
