import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapPackagePreflight, mapReportPackage } from '../src/features/pek/mappers/packageMapper';
import { mapPekError } from '../src/features/pek/utils/pekErrorMapper';

describe('PEK report package backend contract', () => {
  it('maps the real package DTO without legacy status/documents fields', () => {
    const result = mapReportPackage({ data: {
      id: 21,
      reportId: 9,
      documentVersion: 4,
      sourceContentRevision: 12,
      files: ['pek-report.docx', 'pek-report.pdf'],
      missingFields: ['laboratoryId'],
      generatedAt: '2026-08-17T09:00:00Z',
      generatedBy: { id: 7, fullName: 'Эколог' },
      downloadAvailable: true,
      availableActions: { generatePackage: true, downloadPackage: true },
      version: 6,
      missingDocuments: [],
      staleDocuments: [],
      readiness: [],
    } });

    expect(result).toEqual({
      id: 21,
      reportId: 9,
      documentVersion: 4,
      sourceContentRevision: 12,
      files: ['pek-report.docx', 'pek-report.pdf'],
      missingFields: ['laboratoryId'],
      generatedAt: '2026-08-17T09:00:00Z',
      generatedBy: { id: 7, name: 'Эколог' },
      downloadAvailable: true,
      availableActions: { generatePackage: true, downloadPackage: true },
      version: 6,
      missingDocuments: [],
      staleDocuments: [],
      readiness: [],
    });
    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('documents');
  });

  it('uses package actions only and refetches report/document/package after generation', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/features/pek/components/documents/PekReportPackageCard.tsx'), 'utf8');
    expect(component).toContain('getReportPackagePreflight');
    expect(component).not.toContain('regeneratePackage');
    expect(component).toContain('data.availableActions.downloadPackage === true');
    expect(component).toContain('packageQuery.refetch()');
    expect(component).toContain('pekKeys.reportDocuments');
    expect(component).toContain('data.files.map');
    expect(component).not.toContain('data.documents');
    expect(component).not.toContain('data.status');
  });

  it('maps the package preflight checklist and structured issues', () => {
    const result = mapPackagePreflight({ data: {
      reportId: 9, currentContentRevision: 12, ready: false,
      files: [{ key: 'EXPLANATORY_NOTE_PDF', path: '03_note.pdf', title: 'Пояснительная записка', documentType: 'EXPLANATORY_NOTE', format: 'PDF', required: true, status: 'MISSING' }],
      missingDocuments: [{ code: 'DOCUMENT_MISSING', section: 'DOCUMENTS', entityId: null, field: 'pdfFileId', message: 'Сформируйте PDF' }],
      staleDocuments: [], issues: [{ code: 'DOCUMENT_MISSING', section: 'DOCUMENTS', entityId: null, field: 'pdfFileId', message: 'Сформируйте PDF' }],
      availableActions: { generatePackage: false },
    } });
    expect(result.ready).toBe(false);
    expect(result.files[0]).toMatchObject({ status: 'MISSING', documentType: 'EXPLANATORY_NOTE' });
    expect(result.issues[0]).toMatchObject({ code: 'DOCUMENT_MISSING', field: 'pdfFileId' });
  });

  it('shows the backend stale-document error and exact conflict copy', () => {
    expect(mapPekError({ isAxiosError: true, response: { status: 409, data: { code: 'PEK_DOCUMENT_STALE' } } }).message).toBe('Документ устарел. Сформируйте его заново.');
    expect(mapPekError({ isAxiosError: true, response: { status: 412, data: {} } }).message).toBe('Данные были изменены другим сотрудником.\nОбновите страницу и повторите действие.');
    const component = readFileSync(resolve(process.cwd(), 'src/features/pek/components/documents/PekReportDocuments.tsx'), 'utf8');
    expect(component).toContain('latest?.stale');
    expect(component).toContain('report.availableActions[config.downloadAction] === true');
    expect(component).toContain('!latest.stale');
    expect(component).toContain('Сформируйте новую версию');
    expect(component).not.toContain('/STALE|OUTDATED/i');
  });

  it('shows actionable document and package conflicts instead of a generic 409 message', () => {
    expect(mapPekError({ isAxiosError: true, response: { status: 409, data: { code: 'PEK_MONITORING_EMPTY' } } }).message)
      .toContain('нет включённых направлений');
    expect(mapPekError({ isAxiosError: true, response: { status: 409, data: { code: 'PEK_REPORT_DOCUMENT_LOCKED' } } }).message)
      .toContain('после подписания');
    const notReady = mapPekError({ isAxiosError: true, response: { status: 409, data: { code: 'PEK_PACKAGE_NOT_READY', errors: [{ code: 'PROTOCOL_PDF_MISSING', section: 'PROTOCOLS', entityId: 3, field: 'pdfFileId', message: 'Сформируйте PDF протокола' }] } } });
    expect(notReady.issues[0]).toMatchObject({ code: 'PROTOCOL_PDF_MISSING', field: 'pdfFileId' });
  });
});
