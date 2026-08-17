import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapReportPackage } from '../src/features/pek/mappers/packageMapper';

describe('PEK document package', () => {
  it('maps backend package metadata, documents, files, actions and missing fields', () => {
    const result = mapReportPackage({ data: {
      status: 'READY', version: 4, generatedAt: '2026-08-17T09:00:00Z',
      generatedBy: { id: 7, fullName: 'Эколог' }, missingFields: ['laboratoryId'],
      availableActions: { generatePackage: true, downloadPackage: true }, downloadAvailable: true,
      documents: [{ code: 'FINAL_REPORT', name: 'Итоговый отчёт ПЭК', status: 'READY', formats: ['DOCX', 'PDF'], availableActions: { download: true }, files: [{ format: 'PDF', status: 'READY', downloadUrl: '/api/pek/files/10', availableActions: { download: true } }] }],
    } });
    expect(result).toMatchObject({ status: 'READY', version: 4, downloadAvailable: true, missingFields: ['laboratoryId'], generatedBy: { id: 7, name: 'Эколог' } });
    expect(result.documents[0]).toMatchObject({ code: 'FINAL_REPORT', status: 'READY', formats: ['DOCX', 'PDF'] });
    expect(result.documents[0].files[0]).toMatchObject({ format: 'PDF', downloadUrl: '/api/pek/files/10' });
  });

  it('uses only the package backend endpoints and authenticated blob downloads', () => {
    const service = readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekService.ts'), 'utf8');
    const component = readFileSync(resolve(process.cwd(), 'src/features/pek/components/documents/PekReportPackageCard.tsx'), 'utf8');
    expect(service).toContain('/package/generate`');
    expect(service).toContain('/package`');
    expect(service).toContain('/package/download`');
    expect(service.match(/responseType: 'blob'/g)?.length).toBeGreaterThanOrEqual(4);
    expect(component).toContain("'generatePackage'");
    expect(component).toContain("'downloadPackage'");
    expect(component).not.toContain('<a href');
    expect(component).toContain('missingFields.length > 0');
    expect(component).toContain('/staff/protocols/${document.protocolId}');
  });
});
