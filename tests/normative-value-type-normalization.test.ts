import { describe, expect, it } from 'vitest';
import { toCanonicalNormativeRecord } from '../src/services/normativeService';

describe('canonical normative value types', () => {
  it.each([
    ['LESS', 'LE'],
    ['LT', 'LE'],
    ['GREATER', 'GE'],
    ['GT', 'GE'],
  ])('normalizes legacy %s to the backend-supported %s value', (comparisonType, expected) => {
    expect(toCanonicalNormativeRecord({ id: 1, comparisonType, value: 5 }).valueType).toBe(expected);
  });
});
