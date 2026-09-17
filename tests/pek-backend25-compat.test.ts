import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapBackendProtocolType, mapFrontendProtocolType } from '../src/features/protocols/api/protocolTypeMapper';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('PEK backend 25 compatibility', () => {
  it('supports every generated document product and package preflight', () => {
    const contracts = source('src/features/pek/api/pekContracts.ts');
    const service = source('src/features/pek/api/pekService.ts');
    const documents = source('src/features/pek/components/documents/PekReportDocuments.tsx');
    const packageCard = source('src/features/pek/components/documents/PekReportPackageCard.tsx');
    for (const kind of ['EXPLANATORY_NOTE', 'ENVIRONMENTAL_MEASURES', 'EMISSIONS_XLSX']) {
      expect(contracts).toContain(`'${kind}'`);
      expect(documents).toContain(`kind: '${kind}'`);
    }
    expect(service).toContain("'generate-xlsx'");
    expect(service).toContain('/package/preflight');
    expect(packageCard).toContain('preflight.data?.ready === true');
    expect(packageCard).toContain('Что необходимо исправить');
  });

  it('keeps SZZ and industrial emissions as separate backend protocol types', () => {
    expect(mapBackendProtocolType('ambient_air_szz')).toBe('ambient_air');
    expect(mapBackendProtocolType('industrial_emissions')).toBe('industrial_emissions');
    expect(mapFrontendProtocolType('ambient_air')).toBe('AMBIENT_AIR_SZZ');
    expect(mapFrontendProtocolType('industrial_emissions')).toBe('industrial_emissions');
  });
});
