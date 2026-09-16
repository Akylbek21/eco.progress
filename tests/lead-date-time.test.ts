import { describe, expect, it } from 'vitest';
import { formatLeadCreatedAt, leadCreatedAtDateKey, parseLeadCreatedAt } from '../src/utils/leadDateTime';

describe('lead creation time', () => {
  it('converts legacy UTC server text to Kazakhstan time', () => {
    expect(formatLeadCreatedAt('16 сентября 2026, 04:56')).toContain('09:56');
    expect(leadCreatedAtDateKey('16 сентября 2026, 04:56')).toBe('2026-09-16');
  });

  it('handles an ISO timestamp crossing midnight in Kazakhstan', () => {
    expect(formatLeadCreatedAt('2026-09-15T20:30:00Z')).toContain('01:30');
    expect(leadCreatedAtDateKey('2026-09-15T20:30:00Z')).toBe('2026-09-16');
  });

  it('keeps invalid backend text visible', () => {
    expect(parseLeadCreatedAt('unknown')).toBeNull();
    expect(formatLeadCreatedAt('unknown')).toBe('unknown');
  });
});
