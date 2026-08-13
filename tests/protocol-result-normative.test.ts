import { describe, expect, it } from 'vitest';
import { hasUsableProtocolResultNormative } from '../src/features/protocols/utils/protocolResultNormative';
import type { ProtocolResult } from '../src/types/protocols';

const row = (values: ProtocolResult['values'], normativeReference?: ProtocolResult['normativeReference']) => ({
  id: '1', values, normativeReference,
}) as ProtocolResult;

describe('saved protocol normative recognition', () => {
  it('accepts a directory normative returned only as normativeId', () => {
    expect(hasUsableProtocolResultNormative(row({ normativeId: 42, normativeSource: 'DIRECTORY', normativeStatus: 'ACTIVE' }), '2026-08-13')).toBe(true);
  });

  it('requires a reason only for an explicitly manual normative', () => {
    expect(hasUsableProtocolResultNormative(row({ normativeSource: 'MANUAL', normativeValue: 1 }), '2026-08-13')).toBe(false);
    expect(hasUsableProtocolResultNormative(row({ normativeSource: 'MANUAL', normativeValue: 1, manualNormativeReason: 'Нет записи в справочнике' }), '2026-08-13')).toBe(true);
  });

  it('rejects an explicitly inactive directory normative', () => {
    expect(hasUsableProtocolResultNormative(row({ normativeId: 42, normativeSource: 'DIRECTORY', normativeStatus: 'INACTIVE' }), '2026-08-13')).toBe(false);
  });
});
