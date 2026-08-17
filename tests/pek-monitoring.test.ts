import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapProgramMonitoring } from '../src/features/pek/mappers/monitoringMapper';

describe('PEK monitoring directions', () => {
  it('maps backend monitoring types independently from Protocol types', () => {
    const result = mapProgramMonitoring({ data: {
      programId: 5, version: 7,
      availableTypes: [{ code: 'SURFACE_WATER', label: 'Поверхностные воды', enabled: true }],
      availableActions: { create: true },
      items: [{
        id: 11, version: 3, monitoringType: 'SURFACE_WATER', typeLabel: 'Поверхностные воды',
        controlPoints: [{ id: 1, name: 'Выпуск №1' }], indicators: [{ name: 'pH' }], normatives: [{ value: '6–9' }],
        units: ['ед. pH'], periodicity: 'QUARTERLY', plannedResearchCount: 4, actualResearchCount: 2,
        linkedProtocols: [{ id: 42, protocolNumber: 'W-42', protocolType: 'WATER', status: 'SIGNED' }],
        compatibleProtocols: [{ id: 43, protocolNumber: 'W-43', protocolType: 'WASTEWATER', status: 'APPROVED' }],
        availableActions: { edit: true, delete: false }, missingFields: [],
      }],
    } }, 5);
    expect(result.availableTypes[0]).toEqual({ code: 'SURFACE_WATER', label: 'Поверхностные воды', enabled: true });
    expect(result.items[0]).toMatchObject({ monitoringType: 'SURFACE_WATER', plannedResearchCount: 4, actualResearchCount: 2 });
    expect(result.items[0].linkedProtocols[0]).toMatchObject({ id: 42, protocolType: 'WATER' });
    expect(result.items[0].compatibleProtocols[0].id).toBe(43);
  });

  it('uses the canonical CRUD endpoints and backend actions without a frontend permission matrix', () => {
    const service = readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekService.ts'), 'utf8');
    const component = readFileSync(resolve(process.cwd(), 'src/features/pek/components/monitoring/PekProgramMonitoring.tsx'), 'utf8');
    expect(service).toContain('/monitoring`');
    expect(service).toContain('/monitoring/${monitoringId}`');
    expect(service).toContain('api.post(`/pek/programs/${id}/monitoring`');
    expect(service).toContain('api.put(`/pek/programs/${id}/monitoring/${monitoringId}`');
    expect(service).toContain('api.delete(`/pek/programs/${id}/monitoring/${monitoringId}`');
    expect(component).toContain('monitoring.data.availableActions.create === true');
    expect(component).toContain('active.availableActions.edit === true');
    expect(component).toContain('active.availableActions.delete === true');
    expect(component).not.toMatch(/user\?\.role|ADMIN|ECOLOGIST/);
    expect(component).toContain('compatibleProtocols.map');
    expect(component).toContain('/staff/protocols/${protocol.id}');
  });

  it('renders package documents only from the backend manifest', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/features/pek/components/documents/PekReportPackageCard.tsx'), 'utf8');
    expect(component).toContain('data.documents.map');
    expect(component).not.toContain('documentCatalog');
  });
});
