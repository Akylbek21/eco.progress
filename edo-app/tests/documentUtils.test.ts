import { describe, expect, it } from 'vitest';
import { canPerform, signaturePercent, statusLabel, validateSigningRoute } from '../src/features/documents/utils/documentUtils';

describe('document domain helpers', () => {
  it('keeps unknown backend statuses visible', () => {
    expect(statusLabel('BACKEND_NEW_STATUS')).toBe('BACKEND_NEW_STATUS');
    expect(statusLabel('SIGNED')).toBe('Подписан');
  });

  it('formats bounded signature progress', () => {
    expect(signaturePercent(2, 4)).toBe(50);
    expect(signaturePercent(8, 4)).toBe(100);
    expect(signaturePercent(0, 0)).toBe(0);
  });

  it('uses backend availableActions fail closed', () => {
    expect(canPerform(['VIEW', 'SIGN'], 'SIGN')).toBe(true);
    expect(canPerform(undefined, 'SIGN')).toBe(false);
  });

  it('rejects empty steps and duplicate signers', () => {
    expect(validateSigningRoute([])).toContain('Маршрут не содержит шагов');
    expect(validateSigningRoute([{ signerIds: ['a'] }, { signerIds: ['a'] }])).toContain('Подписант a добавлен повторно');
    expect(validateSigningRoute([{ signerIds: [] }])).toContain('Шаг 1 не содержит подписантов');
  });
});
