import type { PekValidationIssue } from '../api/pekContracts';
import type { PekStructuredSectionKey } from '../components/sections/PekProgramStructuredSections';

export type PekProgramTabKey =
  | 'general'
  | 'waste'
  | 'emissions'
  | 'monitoring'
  | 'calculated-control'
  | 'gas-monitoring'
  | 'discharges'
  | 'atmospheric-air'
  | 'water'
  | 'soil'
  | 'inspections'
  | 'organization'
  | 'documents'
  | 'readiness';

export type PekProgramTarget = {
  tab: PekProgramTabKey;
  structuredSection?: PekStructuredSectionKey;
  editGeneral?: boolean;
};

export const pekProgramTabs: Array<{ key: PekProgramTabKey; label: string }> = [
  { key: 'general', label: 'Общие сведения' },
  { key: 'waste', label: 'Отходы' },
  { key: 'emissions', label: 'Источники выбросов' },
  { key: 'monitoring', label: 'Инструментальный контроль' },
  { key: 'calculated-control', label: 'Расчётный контроль' },
  { key: 'discharges', label: 'Сброс сточных вод' },
  { key: 'inspections', label: 'Внутренние проверки' },
  { key: 'organization', label: 'Организация контроля' },
  { key: 'documents', label: 'Документы' },
  { key: 'readiness', label: 'Проверка программы' },
];

const legacyTabKeys: PekProgramTabKey[] = ['general', 'waste', 'emissions', 'monitoring', 'calculated-control', 'gas-monitoring', 'discharges', 'atmospheric-air', 'water', 'soil', 'inspections', 'organization', 'documents', 'readiness'];
export const parsePekProgramTab = (value: string | null): PekProgramTabKey => {
  if (value && legacyTabKeys.includes(value as PekProgramTabKey)) return value as PekProgramTabKey;
  const legacyIndex = Number(value);
  return Number.isInteger(legacyIndex) && legacyIndex >= 0 && legacyIndex < legacyTabKeys.length
    ? legacyTabKeys[legacyIndex]
    : 'general';
};

export const targetForReadinessIssue = (issue: Pick<PekValidationIssue, 'section' | 'code'>): PekProgramTarget => {
  const section = issue.section || '';
  const code = issue.code || '';
  if (section === 'GENERAL') return { tab: 'general', editGeneral: true };
  if (['MONITORING', 'MONITORING_POINTS_REQUIRED', 'INCOMPLETE_MONITORING'].includes(section) || ['NO_MONITORING_DIRECTIONS', 'MONITORING_POINTS_REQUIRED', 'INCOMPLETE_MONITORING'].includes(code)) return { tab: 'monitoring' };
  if (section === 'WASTE') return { tab: 'waste' };
  if (section === 'PERMITS' || section === 'DOCUMENTS' || /PERMIT|DOCUMENT/.test(code)) return { tab: 'documents' };
  if (section === 'INTERNAL_INSPECTIONS') return { tab: 'inspections', structuredSection: 'internal-inspections' };
  if (section === 'MEASUREMENT_QA' || /MEASUREMENT_QA/.test(code)) return { tab: 'organization', structuredSection: 'measurement-qa' };
  if (section === 'EMERGENCY_PROCEDURES' || /EMERGENCY/.test(code)) return { tab: 'organization', structuredSection: 'emergency-procedures' };
  if (section === 'RESPONSIBILITY' || /RESPONSIBILITY/.test(code)) return { tab: 'organization', structuredSection: 'responsibilities' };
  if (section === 'SOURCES') return { tab: 'emissions' };
  if (section === 'INDICATORS' || /INDICATOR/.test(code)) return { tab: 'calculated-control' };
  if (section === 'CONTROL_ITEMS') return { tab: 'monitoring' };
  return { tab: 'readiness' };
};
