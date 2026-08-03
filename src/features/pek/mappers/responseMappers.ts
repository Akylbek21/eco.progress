import type {
  PekAvailableAction,
  PekAvailableActionCode,
  PekDashboard,
  PekProgram,
  PekReport,
} from '../api/pekContracts';
import { pekActionLabels } from '../utils/pekLabels';
import { pekProgramContractSchema, pekReportContractSchema, validatePekContract } from '../api/pekContractSchemas';

type Row = Record<string, unknown>;
const row = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const numberValue = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const optionalNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const named = (value: unknown) => {
  const valueRow = row(value);
  return valueRow.id === undefined ? null : {
    ...valueRow,
    id: numberValue(valueRow.id),
    name: String(valueRow.name || ''),
  };
};

const action = (value: unknown): PekAvailableAction | null => {
  if (typeof value === 'string') {
    const code = value as PekAvailableActionCode;
    return {
      code,
      label: pekActionLabels[code] || value,
      enabled: true,
    };
  }
  const valueRow = row(value);
  if (!valueRow.code) return null;
  return {
    code: String(valueRow.code) as PekAvailableActionCode,
    label: String(valueRow.label || valueRow.code),
    enabled: valueRow.enabled !== false,
    disabledReason: valueRow.disabledReason ? String(valueRow.disabledReason) : null,
    confirmationRequired: Boolean(valueRow.confirmationRequired),
    requiresComment: Boolean(valueRow.requiresComment),
  };
};

export const mapProgramResponse = (value: unknown): PekProgram => {
  const source = row(validatePekContract(pekProgramContractSchema, value, 'программы ПЭК'));
  const responsible = named(source.responsibleUser || source.responsible);
  return {
    ...source,
    id: numberValue(source.id),
    number: String(source.number || ''),
    name: String(source.name || ''),
    description: source.description == null ? null : String(source.description),
    version: numberValue(source.version),
    status: String(source.status || ''),
    validFrom: String(source.validFrom || ''),
    validUntil: String(source.validUntil || ''),
    company: named(source.company),
    object: named(source.object),
    responsible,
    responsibleUser: responsible,
    responsibleUserId: source.responsibleUserId == null ? null : numberValue(source.responsibleUserId),
    readinessPercent: source.readinessPercent == null ? undefined : numberValue(source.readinessPercent),
    updatedAt: source.updatedAt == null ? undefined : String(source.updatedAt),
    availableActions: (Array.isArray(source.availableActions) ? source.availableActions : [])
      .map(action)
      .filter((item): item is PekAvailableAction => item !== null),
    readOnly: Boolean(source.readOnly),
    controlItems: Array.isArray(source.controlItems) ? source.controlItems as PekProgram['controlItems'] : [],
    indicators: Array.isArray(source.indicators) ? source.indicators as PekProgram['indicators'] : [],
    measures: Array.isArray(source.measures) ? source.measures as PekProgram['measures'] : [],
    documents: Array.isArray(source.documents) ? source.documents as PekProgram['documents'] : [],
  };
};

export const mapReportResponse = (
  value: unknown,
  linkedProtocolNumbers: string[] = [],
): PekReport => {
  const source = row(validatePekContract(pekReportContractSchema, value, 'отчёта ПЭК'));
  const responsibleUser = named(source.responsibleUser);
  return {
    ...source,
    id: numberValue(source.id),
    version: numberValue(source.version),
    status: String(source.status || ''),
    periodType: String(source.periodType || 'QUARTER') as PekReport['periodType'],
    year: numberValue(source.reportYear ?? source.year),
    quarter: source.reportQuarter == null && source.quarter == null
      ? null
      : numberValue(source.reportQuarter ?? source.quarter),
    periodStart: String(source.periodStart || ''),
    periodEnd: String(source.periodEnd || ''),
    companyId: numberValue(source.companyId),
    objectId: numberValue(source.objectId),
    programId: numberValue(source.programId),
    company: named(source.company),
    object: named(source.object),
    responsibleUser,
    linkedProtocolCount: numberValue(source.linkedProtocolCount),
    linkedProtocolNumbers,
    lastCollectedAt: source.lastCollectedAt == null ? null : String(source.lastCollectedAt),
  };
};

export const mapCollectionResult = (value: unknown): PekReport => {
  const source = row(value);
  const numbers = Array.isArray(source.linkedProtocolNumbers)
    ? source.linkedProtocolNumbers.map(String)
    : [];
  return mapReportResponse(source.report, numbers);
};

export const mapDashboardResponse = (value: unknown): PekDashboard => {
  const source = row(value);
  return {
    totalReportCount: optionalNumber(source.totalReportCount),
    readinessPercent: optionalNumber(source.readinessPercent),
    criticalIssueCount: optionalNumber(source.criticalIssueCount),
    overdueRiskCount: optionalNumber(source.overdueRiskCount),
    programExecutionPercent: optionalNumber(source.programExecutionPercent),
    openExceedanceCount: optionalNumber(source.openExceedanceCount),
    overdueActionCount: optionalNumber(source.overdueActionCount),
    missingProtocolCount: optionalNumber(source.missingProtocolCount),
    deadlines: (Array.isArray(source.deadlines) ? source.deadlines : []).map((value) => {
      const deadline = row(value);
      return {
        id: numberValue(deadline.id),
        type: String(deadline.type || ''),
        date: String(deadline.date || ''),
        description: String(deadline.description || ''),
      };
    }),
    reports: (Array.isArray(source.reports) ? source.reports : []).map((report) => mapReportResponse(report)),
  };
};
