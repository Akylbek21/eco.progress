import { describe, expect, it } from 'vitest';
import productionFixture from './fixtures/protocol-list-production-2026-07-30.json';
import { normalizeProtocol } from '../src/services/apiProtocolService';
import { hasProtocolAction } from '../src/features/protocols/utils/protocolActions';

describe('captured production protocol list contract (2026-07-30)', () => {
  const protocols = productionFixture.data.items.map(normalizeProtocol);

  it('accepts zero as the initial optimistic-lock version', () => {
    expect(protocols[1].version).toBe(0);
  });

  it('uses current backend statuses without legacy READY mapping', () => {
    expect(protocols[0]).toMatchObject({
      id: '49',
      status: 'CALCULATED',
      templateId: 'workplace_air',
      companySnapshot: {
        companyName: 'Тестовая компания',
        objectName: 'Тестовый объект',
      },
    });
    expect(protocols[1]).toMatchObject({
      id: '48',
      status: 'CALCULATED',
      templateId: 'ambient_air',
      complianceResult: 'DOES_NOT_COMPLY',
    });
  });

  it('uses backend availableActions and otherwise fails closed', () => {
    expect(hasProtocolAction(protocols[0], 'sendToApproval')).toBe(true);
    expect(hasProtocolAction(protocols[0], 'createCorrection')).toBe(false);
    expect(hasProtocolAction(protocols[0], 'downloadPdf')).toBe(false);
    expect(hasProtocolAction(protocols[0], 'generatePdf')).toBe(false);
  });
});
