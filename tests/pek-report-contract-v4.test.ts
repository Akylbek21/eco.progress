import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapReportResponse } from '../src/features/pek/mappers/responseMappers';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('PEK report and program aggregate contract', () => {
  it('keeps deadline and submission workflow timestamps separate from the reporting period', () => {
    const report = mapReportResponse({
      id: 9, companyId: 1, objectId: 2, programId: 3, version: 6, contentRevision: 8,
      regulationVersion: 'Rules-250/2026', templateVersion: 'official-v3', status: 'REJECTED',
      reportType: 'PEM_CASPIAN_ANNUAL',
      periodType: 'YEAR', reportYear: 2026, reportQuarter: null,
      periodStart: '2026-01-01', periodEnd: '2026-12-31', submissionDueDate: '2027-03-01',
      submittedAt: '2026-07-10T10:00:00Z', acceptedAt: null,
      rejectedAt: '2026-07-11T10:00:00Z', rejectionReason: 'Исправить расчёты', linkedProtocolCount: 2,
    });
    expect(report.submissionDueDate).toBe('2027-03-01');
    expect(report.submissionDueDate).not.toBe(report.periodEnd);
    expect(report.reportType).toBe('PEM_CASPIAN_ANNUAL');
    expect(report).toMatchObject({ status: 'REJECTED', rejectionReason: 'Исправить расчёты' });
  });

  it('shows the statutory annual report names instead of a generic year label', () => {
    const labels = source('src/features/pek/utils/pekLabels.ts');
    const createPage = source('src/features/pek/pages/PekReportCreatePage.tsx');
    expect(labels).toContain("PEK_TABLES_7_12_ANNUAL: 'Годовые таблицы ПЭК'");
    expect(labels).toContain("PEM_CASPIAN_ANNUAL: 'Годовой производственный мониторинг Каспия'");
    expect(createPage).toContain("context.data?.reportType === 'PEM_CASPIAN_ANNUAL'");
    expect(createPage).not.toContain('<option value="YEAR">Год</option>');
  });

  it('maps official and internal generation onto the backend document resource', () => {
    const service = source('src/features/pek/api/pekService.ts');
    const component = source('src/features/pek/components/documents/PekReportDocuments.tsx');
    expect(service).toContain("kind === 'OFFICIAL' ? `generate-official-${format}` : `generate-internal-${format}`");
    expect(service).toContain("/download/${format}");
    expect(component).toContain("kind: 'OFFICIAL'");
    expect(component).toContain("kind: 'INTERNAL_ANALYTICAL'");
    expect(component).toContain('version.templateVersion');
    expect(component).toContain('version.regulationVersion');
    expect(component).toContain("formats: ['docx', 'pdf']");
  });

  it('versions monitoring by the program aggregate and marks derived data stale', () => {
    const service = source('src/features/pek/api/pekService.ts');
    const component = source('src/features/pek/components/monitoring/PekProgramMonitoring.tsx');
    expect(service).toContain('pekMutationOptions(programVersion)');
    expect(component).toContain('program.version');
    expect(component).not.toContain('editing.version');
    expect(component).not.toContain('deleting.version');
    expect(component).toContain('queryClient.setQueryData');
    expect(component).toContain('stale: true');
  });
});
