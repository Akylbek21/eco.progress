import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePekProgramTab, targetForReadinessIssue } from '../src/features/pek/pages/pekProgramNavigation';

describe('PEK program readiness navigation', () => {
  it.each([
    [{ section: 'MONITORING', code: 'NO_MONITORING_DIRECTIONS' }, 'monitoring'],
    [{ section: 'MONITORING_POINTS_REQUIRED', code: 'MONITORING_POINTS_REQUIRED' }, 'monitoring'],
    [{ section: 'INCOMPLETE_MONITORING', code: 'INCOMPLETE_MONITORING' }, 'monitoring'],
  ])('opens PekProgramMonitoring for %o', (issue, expected) => {
    expect(targetForReadinessIssue(issue).tab).toBe(expected);
    expect(targetForReadinessIssue(issue).tab).not.toBe('waste');
  });

  it.each([
    ['WASTE', 'waste', undefined],
    ['PERMITS', 'documents', undefined],
    ['INTERNAL_INSPECTIONS', 'inspections', 'internal-inspections'],
    ['MEASUREMENT_QA', 'organization', 'measurement-qa'],
    ['EMERGENCY_PROCEDURES', 'organization', 'emergency-procedures'],
    ['RESPONSIBILITY', 'organization', 'responsibilities'],
  ])('opens the corrective form for %s', (section, tab, structuredSection) => {
    expect(targetForReadinessIssue({ section, code: `NO_${section}` })).toEqual({
      tab,
      ...(structuredSection ? { structuredSection } : {}),
    });
  });

  it('uses stable named tabs while preserving old numeric links', () => {
    expect(parsePekProgramTab('monitoring')).toBe('monitoring');
    expect(parsePekProgramTab('3')).toBe('monitoring');
    expect(parsePekProgramTab('unknown')).toBe('general');
  });

  it('renders the existing monitoring component and its create action', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekProgramDetailsPage.tsx'), 'utf8');
    const monitoring = readFileSync(resolve(process.cwd(), 'src/features/pek/components/monitoring/PekProgramMonitoring.tsx'), 'utf8');
    expect(page).toContain("['monitoring', 'gas-monitoring', 'atmospheric-air', 'water', 'soil'].includes(tab)");
    expect(page).toContain('<PekProgramMonitoring program={item} />');
    expect(monitoring).toContain('Добавить направление');
    expect(page).not.toContain('setTab(1)');
  });
});
