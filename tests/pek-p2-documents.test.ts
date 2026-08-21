import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import api from '../src/services/api';
import { pekApi } from '../src/features/pek/api/pekService';

const calls: Array<{ path: string; authorization: string | null }> = [];
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    clear: () => storage.clear(),
  },
});
const server = setupServer(
  http.get('*/api/pek/reports/9/document/versions/:versionId/download/:format', ({ request }) => {
    const url = new URL(request.url);
    calls.push({ path: url.pathname, authorization: request.headers.get('Authorization') });
    const format = url.pathname.endsWith('/pdf') ? 'pdf' : 'docx';
    return new HttpResponse('protected-file', {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="history.${format}"`,
      },
    });
  }),
);

beforeAll(() => {
  api.defaults.baseURL = 'http://localhost/api';
  localStorage.setItem('eco-progress-token', 'document-token');
  server.listen({ onUnhandledRequest: 'error' });
});
afterAll(() => {
  server.close();
  localStorage.clear();
});

const component = () => readFileSync(resolve(process.cwd(), 'src/features/pek/components/documents/PekReportDocuments.tsx'), 'utf8');
const contracts = () => readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekContracts.ts'), 'utf8');
const service = () => readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekService.ts'), 'utf8');

describe('PEK P2 historical documents', () => {
  it('downloads historical DOCX and PDF through authenticated API by version.id', async () => {
    const docx = await pekApi.downloadReportDocumentVersion(9, 41, 'docx');
    const pdf = await pekApi.downloadReportDocumentVersion(9, 42, 'pdf');

    expect(calls).toEqual([
      { path: '/api/pek/reports/9/document/versions/41/download/docx', authorization: 'Bearer document-token' },
      { path: '/api/pek/reports/9/document/versions/42/download/pdf', authorization: 'Bearer document-token' },
    ]);
    expect(docx.filename).toBe('history.docx');
    expect(pdf.filename).toBe('history.pdf');
    expect(docx.blob).toBeTruthy();
    expect(service()).toContain("responseType: 'blob'");
  });

  it('shows historical buttons only from hasDocx/hasPdf and passes version.id', () => {
    const source = component();
    expect(source).toContain('version.hasDocx === true');
    expect(source).toContain("onDownload(version.id, 'docx')");
    expect(source).toContain('version.hasPdf === true');
    expect(source).toContain("onDownload(version.id, 'pdf')");
    expect(source).not.toContain('latestVersion.id');
  });

  it('uses backend stale label without blocking historical files', () => {
    const source = component();
    expect(source).toContain("version.stale ? 'Устаревшая версия' : 'Актуальная версия'");
    expect(source).not.toMatch(/version\.status|version\.isActual/);
    expect(source).not.toContain('version.stale &&');
    expect(source).not.toContain('!version.stale');
  });

  it('uses one PekDocumentVersion DTO for latest and history', () => {
    const dto = contracts();
    expect(dto).toContain('export interface PekDocumentVersion');
    for (const field of ['generatedById?: number', 'generatedByName?: string', 'sourceContentRevision: number', 'currentContentRevision: number', 'stale: boolean', 'hasDocx: boolean', 'hasPdf: boolean', 'sha256?: string']) {
      expect(dto).toContain(field);
    }
    expect(component()).toContain('version: PekDocumentVersion');
    expect(service()).toContain('get<PekDocumentVersion[]>');
    expect(dto).not.toContain('PekReportDocumentVersion');
  });

  it('contains no legacy protected document endpoints or file ids', () => {
    const all = `${service()}\n${component()}\n${contracts()}`;
    expect(all).not.toContain('/document/signatures/${signatureId}/cms');
    expect(all).not.toContain('signatureFileId');
    expect(all).not.toContain('cmsFileId');
    expect(all).not.toContain('Скачивание исторической версии не поддерживается backend');
  });
});
