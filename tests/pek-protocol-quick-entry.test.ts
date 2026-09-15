import { describe, expect, it } from 'vitest';
import type { ProtocolCreationRequirement } from '../src/features/protocols/api/protocolCreationContracts';
import { indicatorsForRequirement, normativeLabel, resultNumber } from '../src/features/pek/components/protocols/PekProtocolQuickEntryDialog';
import type { PekIndicator } from '../src/features/pek/api/pekContracts';

const requirement: ProtocolCreationRequirement = {
  id: 'air-01', status: 'DUE', title: 'Воздух — северная точка', planCount: 3,
  completedCount: 0, missingCount: 3, canCreate: true, companyId: 1, objectId: 2,
  pekProgramId: 14, pekMonitoringId: 3, pekControlItemId: 4, monitoringPointId: 2,
  monitoringPointName: 'ТК-01 — Северная', protocolTemplateId: 'ambient_air',
  indicators: [{ id: 101, name: 'Пыль', unit: 'мг/м3', normativeLabel: '≤ 0.50' }],
};

describe('PEK protocol quick entry helpers', () => {
  it('accepts dot and comma decimal results and rejects non-numbers', () => {
    expect(resultNumber('0.18')).toBe(0.18);
    expect(resultNumber('0,24')).toBe(0.24);
    expect(resultNumber('')).toBeNull();
    expect(resultNumber('abc')).toBeNull();
  });

  it('uses the authoritative program indicator and normative instead of the context label', () => {
    const programIndicator: PekIndicator = {
      id: 501, controlItemId: 4, indicatorId: 101, indicatorCode: 'DEMO-DUST',
      indicatorName: 'Пыль — тестовый показатель', unit: 'мг/м3', normativeId: 77,
      normativeValue: 0.5, comparisonType: 'LESS_OR_EQUAL', mandatory: true, sortOrder: 1,
    };
    const rows = indicatorsForRequirement(requirement, [programIndicator]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 501, indicatorCode: 'DEMO-DUST', normativeValue: 0.5 });
    expect(normativeLabel(rows[0])).toBe('0.5');
  });

  it('falls back to indicators returned by creation-context when program rows are absent', () => {
    const rows = indicatorsForRequirement(requirement, []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ indicatorName: 'Пыль', unit: 'мг/м3', controlItemId: 4 });
  });
});
