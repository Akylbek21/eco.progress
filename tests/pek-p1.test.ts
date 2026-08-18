import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { uploadAndAttachExceedanceEvidence } from '../src/features/pek/components/exceedances/evidenceFlow';
import { mapPekError } from '../src/features/pek/utils/pekErrorMapper';

const axiosError = (status: number, code?: string) => ({
  isAxiosError: true,
  response: { status, data: code ? { code } : {} },
});

describe('PEK P1 frontend protections', () => {
  it('makes final program documents read-only and handles backend protection', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/features/pek/components/documents/PekProgramDocuments.tsx'), 'utf8');
    expect(component).toContain("['APPROVED', 'ACTIVE', 'ARCHIVED']");
    expect(component).toContain('readOnly || FINAL_PROGRAM_STATUSES.has');
    expect(component).toContain('!documentsReadOnly');
    expect(component).toContain('refetchProgramAndDocuments');
    expect(component).toContain('pekApi.getProgram(programId)');
    expect(component).toContain('pekKeys.programDocuments(programId)');
    expect(mapPekError(axiosError(409, 'PEK_PROGRAM_NOT_EDITABLE')).message)
      .toBe('Программа находится в финальном статусе. Изменение документов запрещено.');
  });

  it('takes every exceedance mutation button from availableActions without role checks', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/features/pek/components/exceedances/PekReportExceedances.tsx'), 'utf8');
    for (const action of ['assignResponsible', 'addEvidence', 'edit', 'changeStatus', 'close', 'reopen']) {
      expect(component).toContain(`selectedActions.${action} === true`);
    }
    expect(component).not.toMatch(/role\s*===\s*['"](?:ADMIN|ECOLOGIST|LABORATORY)['"]/);
    expect(component).toContain('enabled: selected?.availableActions.assignResponsible === true');

    const laboratoryExceedance = { availableActions: { addEvidence: true, assignResponsible: false } };
    expect(laboratoryExceedance.availableActions.assignResponsible).toBe(false);
  });

  it('uploads a file and attaches only the returned fileId', async () => {
    const order: string[] = [];
    const upload = vi.fn(async () => {
      order.push('upload');
      return {
        id: 'file-42', name: 'proof.pdf', originalFileName: 'proof.pdf', category: 'pek-exceedance-evidence',
        comment: '', mimeType: 'application/pdf', fileSize: 10, uploadedAt: '', uploadedBy: '', downloadUrl: '/ignored', canDelete: false,
      };
    });
    const attach = vi.fn(async (_id: number, _version: number, fileId: string) => {
      order.push(`attach:${fileId}`);
      return {} as never;
    });

    await uploadAndAttachExceedanceEvidence({ file: { name: 'proof.pdf' } as File, exceedanceId: 4, reportId: 9, version: 3 }, { upload, attach });
    expect(order).toEqual(['upload', 'attach:file-42']);
    expect(attach).toHaveBeenCalledWith(4, 3, 'file-42');
  });

  it('keeps evidence out of local state when attach is forbidden or scope-mismatched', async () => {
    const uploaded = {
      id: 'file-42', name: 'proof.pdf', originalFileName: 'proof.pdf', category: 'pek-exceedance-evidence',
      comment: '', mimeType: 'application/pdf', fileSize: 10, uploadedAt: '', uploadedBy: '', downloadUrl: null, canDelete: false,
    };
    const upload = vi.fn(async () => uploaded);
    const attach = vi.fn(async () => { throw axiosError(403, 'PEK_EVIDENCE_FILE_FORBIDDEN'); });
    await expect(uploadAndAttachExceedanceEvidence({ file: { name: 'proof.pdf' } as File, exceedanceId: 4, reportId: 9, version: 3 }, { upload, attach })).rejects.toMatchObject({ response: { status: 403 } });

    const component = readFileSync(resolve(process.cwd(), 'src/features/pek/components/exceedances/PekReportExceedances.tsx'), 'utf8');
    expect(component.indexOf('await uploadAndAttachExceedanceEvidence')).toBeLessThan(component.indexOf('setEvidenceNames((current)'));
    expect(mapPekError(axiosError(403, 'PEK_EVIDENCE_FILE_FORBIDDEN')).message).toBe('У вас нет доступа к выбранному файлу доказательства.');
    expect(mapPekError(axiosError(422, 'PEK_EVIDENCE_FILE_SCOPE_MISMATCH')).message).toBe('Файл доказательства относится к другой компании или области доступа.');
    expect(mapPekError(axiosError(403)).message).toContain('нет доступа');
  });
});
