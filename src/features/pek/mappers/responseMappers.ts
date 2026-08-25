import type {
  PekDashboard,
  PekCollectResponse,
  PekExceedance,
  PekProgram,
  PekReport,
} from '../api/pekContracts';
import { pekProgramContractSchema, pekReportContractSchema, validatePekContract } from '../api/pekContractSchemas';
import { mapProgramMonitoring } from './monitoringMapper';

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

const returnInfo = (value: unknown): PekReport['returnInfo'] => {
  if (value === null || value === undefined) return null;
  const source = row(value);
  const returnedBy = row(source.returnedBy);
  return {
    reason: source.reason == null ? undefined : String(source.reason),
    comment: source.comment == null ? undefined : String(source.comment),
    returnedAt: source.returnedAt == null ? undefined : String(source.returnedAt),
    returnedBy: Object.keys(returnedBy).length ? {
      id: optionalNumber(returnedBy.id),
      name: returnedBy.name == null ? undefined : String(returnedBy.name),
    } : undefined,
  };
};

const availableActionFlags = (value: unknown): Record<string, boolean> => Object.fromEntries(
  Object.entries(row(value)).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
);

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
    contentRevision: numberValue(source.contentRevision),
    regulationVersion: source.regulationVersion == null ? null : String(source.regulationVersion),
    templateVersion: source.templateVersion == null ? null : String(source.templateVersion),
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
    availableActions: {
      edit: availableActionFlags(source.availableActions).edit === true,
      submit: availableActionFlags(source.availableActions).submit === true,
      approve: availableActionFlags(source.availableActions).approve === true,
      returnForRevision: availableActionFlags(source.availableActions).returnForRevision === true,
      activate: availableActionFlags(source.availableActions).activate === true,
      archive: availableActionFlags(source.availableActions).archive === true,
      clone: availableActionFlags(source.availableActions).clone === true,
      uploadDocument: availableActionFlags(source.availableActions).uploadDocument === true,
    },
    readOnly: Boolean(source.readOnly),
    readiness: Object.keys(row(source.readiness)).length ? source.readiness as PekProgram['readiness'] : null,
    controlItems: Array.isArray(source.controlItems) ? source.controlItems as PekProgram['controlItems'] : [],
    indicators: Array.isArray(source.indicators) ? source.indicators as PekProgram['indicators'] : [],
    measures: Array.isArray(source.measures) ? source.measures as PekProgram['measures'] : [],
    monitoring: mapProgramMonitoring({
      programId: source.id,
      programVersion: source.version,
      contentRevision: source.contentRevision,
      readiness: source.readiness,
      readinessPercent: source.readinessPercent,
      items: Array.isArray(source.monitoring)
        ? source.monitoring
        : Array.isArray(row(source.monitoring).items)
          ? row(source.monitoring).items
          : Array.isArray(source.monitoringDirections)
            ? source.monitoringDirections
            : [],
      availableActions: row(source.monitoring).availableActions,
    }, numberValue(source.id)),
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
    contentRevision: numberValue(source.contentRevision),
    regulationVersion: source.regulationVersion == null ? null : String(source.regulationVersion),
    templateVersion: source.templateVersion == null ? null : String(source.templateVersion),
    status: String(source.status || ''),
    periodType: String(source.periodType || 'QUARTER') as PekReport['periodType'],
    year: numberValue(source.reportYear ?? source.year),
    quarter: source.reportQuarter == null && source.quarter == null
      ? null
      : numberValue(source.reportQuarter ?? source.quarter),
    periodStart: String(source.periodStart || ''),
    periodEnd: String(source.periodEnd || ''),
    submissionDueDate: source.submissionDueDate == null ? null : String(source.submissionDueDate),
    submittedAt: source.submittedAt == null ? null : String(source.submittedAt),
    acceptedAt: source.acceptedAt == null ? null : String(source.acceptedAt),
    rejectedAt: source.rejectedAt == null ? null : String(source.rejectedAt),
    rejectionReason: source.rejectionReason == null ? null : String(source.rejectionReason),
    companyId: numberValue(source.companyId),
    objectId: numberValue(source.objectId),
    programId: numberValue(source.programId),
    company: named(source.company),
    object: named(source.object),
    responsibleUser,
    linkedProtocolCount: numberValue(source.linkedProtocolCount),
    linkedProtocolNumbers,
    lastCollectedAt: source.lastCollectedAt == null ? null : String(source.lastCollectedAt),
    availableActions: availableActionFlags(source.availableActions) as PekReport['availableActions'],
    returnInfo: returnInfo(source.returnInfo),
  };
};

export const mapExceedanceResponse = (value: unknown): PekExceedance => {
  const source = row(value);
  const responsible = row(source.responsibleUser);
  return {
    ...source,
    id: numberValue(source.id),
    reportId: numberValue(source.reportId),
    planFactRowId: numberValue(source.planFactRowId),
    protocolId: numberValue(source.protocolId),
    protocolResultId: numberValue(source.protocolResultId),
    programIndicatorId: numberValue(source.programIndicatorId),
    status: String(source.status || ''),
    responsibleUserId: optionalNumber(source.responsibleUserId),
    responsibleUser: Object.keys(responsible).length ? {
      id: numberValue(responsible.id),
      fullName: responsible.fullName == null ? undefined : String(responsible.fullName),
      name: responsible.name == null ? undefined : String(responsible.name),
    } : null,
    evidenceFileIds: Array.isArray(source.evidenceFileIds) ? source.evidenceFileIds.map(String) : [],
    version: numberValue(source.version),
    availableActions: availableActionFlags(source.availableActions),
    allowedTransitions: Array.isArray(source.allowedTransitions) ? source.allowedTransitions.map(String) : [],
  };
};

export const mapCollectionResult = (value: unknown): PekCollectResponse => {
  const source = row(value);
  const numbers = Array.isArray(source.linkedProtocolNumbers)
    ? source.linkedProtocolNumbers.map(String)
    : [];
  return {
    report: mapReportResponse(source.report, numbers),
    linkedProtocolCount: numberValue(source.linkedProtocolCount),
    linkedProtocolNumbers: numbers,
    protocolResultCount: numberValue(source.protocolResultCount),
    matchedCount: numberValue(source.matchedCount),
    unmatchedCount: numberValue(source.unmatchedCount),
    ambiguousCount: numberValue(source.ambiguousCount),
    removedStaleSourceCount: numberValue(source.removedStaleSourceCount),
    updatedSourceCount: numberValue(source.updatedSourceCount),
    warnings: Array.isArray(source.warnings) ? source.warnings.map(String) : [],
  };
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
    returnedReportCount: optionalNumber(source.returnedReportCount),
    signedReportCount: optionalNumber(source.signedReportCount),
    draftReportCount: optionalNumber(source.draftReportCount),
    unmatchedSourceCount: optionalNumber(source.unmatchedSourceCount),
    ambiguousSourceCount: optionalNumber(source.ambiguousSourceCount),
    staleSourceCount: optionalNumber(source.staleSourceCount),
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
