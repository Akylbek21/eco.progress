import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapProgramResponse } from '../src/features/pek/mappers/responseMappers';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('report creation program re-template', () => {
  it.each(['RETEMPLATE', 'UPDATE_TEMPLATE'])('recognizes backend action %s', (code) => {
    const program = mapProgramResponse({
      id: 9, number: 'P-9', name: 'ПЭК', version: 4, contentRevision: 7,
      validFrom: '2026-01-01', validUntil: '2026-12-31', status: 'DRAFT',
      availableActions: [{ code, enabled: true }],
    });
    expect(program.availableActions.retemplate).toBe(true);
  });

  it('passes current version and refreshes creation context before redirecting to readiness', () => {
    const page = source('src/features/pek/pages/PekReportCreatePage.tsx');
    const service = source('src/features/pek/api/pekService.ts');
    expect(page).toContain('pekApi.retemplateProgram(selectedProgram!.id, selectedProgram!.version)');
    expect(page).toContain('client.invalidateQueries({ queryKey: pekKeys.creationContext(params, user?.id) })');
    expect(page).toContain('&tab=13');
    expect(page).toContain('selectedProgram?.availableActions.retemplate === true');
    expect(page).not.toContain("['ACTIVE', 'APPROVED', 'UNDER_REVIEW'].includes(selectedProgram.status)");
    expect(service).toContain("api.post(`/pek/programs/${id}/retemplate`, {}, pekMutationOptions(version))");
  });
});
