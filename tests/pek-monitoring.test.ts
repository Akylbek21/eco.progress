import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapProgramMonitoring } from '../src/features/pek/mappers/monitoringMapper';

describe('PEK monitoring backend contract', () => {
  it('maps only the real monitoring DTO fields', () => {
    const result = mapProgramMonitoring({ data: {
      programId: 5,
      availableActions: { create: true },
      items: [{
        id: 11,
        programId: 5,
        monitoringType: 'SURFACE_WATER',
        name: 'Поверхностные воды',
        methodology: 'СТ РК 1',
        laboratoryId: 7,
        frequencyType: 'QUARTERLY',
        plannedCount: 4,
        controlItemIds: [101, 102],
        protocolTypes: ['WATER'],
        active: true,
        version: 3,
        availableActions: { edit: true, delete: false },
      }],
    } }, 5);

    expect(result.items[0]).toEqual({
      id: 11,
      programId: 5,
      monitoringType: 'SURFACE_WATER',
      name: 'Поверхностные воды',
      methodology: 'СТ РК 1',
      laboratoryId: 7,
      frequencyType: 'QUARTERLY',
      plannedCount: 4,
      controlItemIds: [101, 102],
      protocolTypes: ['WATER'],
      active: true,
      version: 3,
      availableActions: { edit: true, delete: false },
    });
  });

  it('uses If-Match for PUT and DELETE and never sends a DELETE body', () => {
    const service = readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekService.ts'), 'utf8');
    expect(service).toContain("api.put(`/pek/programs/${id}/monitoring/${monitoringId}`, body, pekMutationOptions(version))");
    expect(service).toContain("api.delete(`/pek/programs/${id}/monitoring/${monitoringId}`, pekMutationOptions(version))");
    expect(service).not.toContain("api.delete(`/pek/programs/${id}/monitoring/${monitoringId}`, { data:");
  });

  it('renders CRUD buttons only from backend availableActions and refetches after mutations', () => {
    const component = readFileSync(resolve(process.cwd(), 'src/features/pek/components/monitoring/PekProgramMonitoring.tsx'), 'utf8');
    expect(component).toContain('monitoring.data.availableActions.create === true');
    expect(component).toContain('item.availableActions.edit === true');
    expect(component).toContain('item.availableActions.delete === true');
    expect(component).toContain('await monitoring.refetch()');
    expect(component).not.toMatch(/user\?\.role|ADMIN|ECOLOGIST/);
  });
});
