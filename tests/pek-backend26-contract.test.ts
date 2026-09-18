import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('backend 26 PEK frontend coverage', () => {
  it('connects all new report package inputs', () => {
    const service = read('src/features/pek/api/pekService.ts');
    for (const endpoint of ['measure-executions', 'emission-balances', 'operation-explanation']) expect(service).toContain(endpoint);
    const ui = read('src/features/pek/components/official/PekReportPackageInputs.tsx');
    expect(ui).toContain('NOT_OPERATING');
    expect(ui).toContain('TEMPORARILY_SUSPENDED');
  });

  it('connects first-head signing settings and permits', () => {
    const settings = read('src/features/pek/pages/PekSettingsPage.tsx');
    expect(settings).toContain('firstHeadUserId');
    expect(settings).toContain('firstHeadPosition');
    const service = read('src/features/pek/api/pekService.ts');
    for (const endpoint of ['/revisions', '/conditions', '/activate', '/permit-limits']) expect(service).toContain(endpoint);
  });

  it('connects sampling acts and allows signed package generation', () => {
    expect(read('src/features/protocols/api/protocolSamplingActsApi.ts')).toContain('/sampling-acts');
    const guard = read('src/features/pek/utils/pekPackageActions.ts');
    expect(guard).not.toContain("report.status === 'SIGNED'");
    expect(guard).toContain("report.status === 'ARCHIVED'");
  });
});
