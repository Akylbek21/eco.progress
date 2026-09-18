import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('backend 27 PEK frontend coverage', () => {
  it('connects program rule and lookup endpoints', () => {
    const service = read('src/features/pek/api/pekService.ts');
    for (const endpoint of ['section-applicability', '/normatives', 'apply-normatives', 'lookups/device-types', 'lookups/methods', 'lookups/indicators', 'responsible-users', 'approval-snapshots']) expect(service).toContain(endpoint);
  });

  it('requires one control location and a normative source', () => {
    const schema = read('src/features/pek/validation/programSchema.ts');
    expect(schema).toContain('locationCount !== 1');
    expect(schema).toContain('manualNormativeReason');
    const sourceSelect = read('src/features/pek/components/inventory/PekControlSourceSelect.tsx');
    expect(sourceSelect).toContain('appliesToAllPoints');
    expect(sourceSelect).toContain('clearLocation');
  });

  it('renders applicability, permit normatives and approval snapshots', () => {
    expect(read('src/features/pek/components/rules/PekProgramRules.tsx')).toContain('Снимки утверждения');
    expect(read('src/features/pek/components/permits/PekPermitNormatives.tsx')).toContain('Нормативы разрешения');
    expect(read('src/features/pek/model/pekDictionaries.ts')).toContain('BIODIVERSITY');
  });
});
