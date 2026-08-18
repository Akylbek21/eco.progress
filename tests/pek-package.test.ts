import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapReportPackage } from '../src/features/pek/mappers/packageMapper';
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
      availableActions: { regeneratePackage: true, downloadPackage: true },
      version: 6,
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
      availableActions: { regeneratePackage: true, downloadPackage: true },
      version: 6,
    });
    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('documents');
  });

  it('uses package actions only and refetches report/document/package after generation', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/features/pek/components/documents/PekReportPackageCard.tsx'), 'utf8');
    expect(component).toContain('data.availableActions.generatePackage === true');
    expect(component).toContain('data.availableActions.regeneratePackage === true');
    expect(component).toContain('data.availableActions.downloadPackage === true');
    expect(component).toContain('packageQuery.refetch()');
    expect(component).toContain('pekKeys.reportDocuments');
    expect(component).toContain('data.files.map');
    expect(component).not.toContain('data.documents');
    expect(component).not.toContain('data.status');
  });

  it('shows the backend stale-document error and exact conflict copy', () => {
    expect(mapPekError({ isAxiosError: true, response: { status: 409, data: { code: 'PEK_DOCUMENT_STALE' } } }).message).toBe('Документ устарел. Сформируйте его заново.');
    expect(mapPekError({ isAxiosError: true, response: { status: 412, data: {} } }).message).toBe('Данные были изменены другим пользователем. Обновите страницу.');
    const component = readFileSync(resolve(process.cwd(), 'src/features/pek/components/documents/PekReportDocuments.tsx'), 'utf8');
    expect(component).toContain("mapped.code === 'PEK_DOCUMENT_STALE'");
    expect(component).toContain('disabled={busy || documentIsStale}');
    expect(component).toContain('Пересформировать PDF');
    expect(component).not.toContain('/STALE|OUTDATED/i');
  });
});
