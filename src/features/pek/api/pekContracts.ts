export type PekId = number;
export type PekProgramStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'RETURNED'
  | 'APPROVED'
  | 'ACTIVE'
  | 'ARCHIVED';
export type PekReportStatus =
  | 'DRAFT'
  | 'COLLECTING'
  | 'READY_FOR_REVIEW'
  | 'RETURNED'
  | 'APPROVED'
  | 'ARCHIVED';
export type PekPeriodType = 'QUARTER' | 'YEAR';
export type ComparisonType =
  | 'LESS_OR_EQUAL'
  | 'GREATER_OR_EQUAL'
  | 'RANGE'
  | 'BETWEEN'
  | 'EQUAL'
  | 'ABSENT'
  | 'INFO';
export type PekControlType =
  | 'EMISSION'
  | 'AMBIENT_AIR'
  | 'WATER_INTAKE'
  | 'WASTEWATER'
  | 'WASTE'
  | 'SOIL'
  | 'PHYSICAL_FACTOR'
  | 'BIODIVERSITY';
export type PekPeriodicity =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'ANNUAL'
  | 'PER_EVENT';
export type PekActionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
export type PekMatchStatus = 'MATCHED' | 'MANUAL' | 'MANUALLY_MATCHED' | 'UNMATCHED' | 'AMBIGUOUS' | 'STALE' | 'EXCLUDED';

export type ApiResponse<T> = { success?: boolean; message?: string | null; data: T };
export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export type PekNamedRef = {
  id: PekId;
  name: string;
  code?: string;
  address?: string;
  bin?: string;
};
export type PekLookupOption = PekNamedRef & {
  description?: string;
  status?: string;
  role?: string;
  validFrom?: string;
  validUntil?: string;
};

export type PekAvailableActionCode =
  | 'EDIT'
  | 'SUBMIT_REVIEW'
  | 'RETURN'
  | 'APPROVE'
  | 'ACTIVATE'
  | 'ARCHIVE'
  | 'CLONE';
export type PekAvailableAction = {
  code: PekAvailableActionCode;
  label: string;
  enabled: boolean;
  disabledReason?: string | null;
  confirmationRequired?: boolean;
  requiresComment?: boolean;
};
export type PekAvailableActions = readonly PekAvailableAction[];

export interface PekControlItem {
  id?: PekId;
  clientId?: string;
  code: string;
  name: string;
  sectionCode?: string | null;
  controlType?: PekControlType | null;
  environmentComponent?: string | null;
  monitoringPointId?: PekId | null;
  emissionSourceId?: PekId | null;
  waterOutletId?: PekId | null;
  wasteSourceId?: PekId | null;
  laboratoryId?: PekId | null;
  frequencyType?: PekPeriodicity | null;
  frequencyValue?: number | null;
  plannedCount?: number | null;
  measurementMethod?: string | null;
  samplingMethod?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  responsibleUserId?: PekId | null;
  mandatory: boolean;
  sortOrder: number;
  active: boolean;
}

export interface PekIndicator {
  id?: PekId;
  clientId?: string;
  controlItemIndex?: number;
  controlItemId?: PekId;
  controlItemClientId?: string;
  indicatorId?: PekId | null;
  indicatorCode?: string | null;
  indicatorName: string;
  unit?: string | null;
  normativeId?: PekId | null;
  normativeValue?: number | null;
  comparisonType?: ComparisonType | null;
  minValue?: number | null;
  maxValue?: number | null;
  methodologyId?: PekId | null;
  measurementDeviceType?: string | null;
  mandatory: boolean;
  sortOrder: number;
}

export interface PekMeasure {
  id?: PekId;
  clientId?: string;
  code?: string | null;
  name: string;
  description?: string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  responsibleUserId?: PekId | null;
  plannedBudget?: number | null;
  currency?: string | null;
  status?: PekActionStatus | null;
  completionPercent?: number | null;
  resultDescription?: string | null;
}

export interface PekProgramDocument {
  id: PekId;
  fileName?: string;
  originalFileName?: string;
  documentType?: string;
  contentType?: string;
  size?: number;
  uploadedAt?: string;
}

export interface PekProgram {
  id: PekId;
  number: string;
  name: string;
  description?: string | null;
  version: number;
  status: PekProgramStatus | string;
  company?: PekNamedRef | null;
  object?: PekNamedRef | null;
  validFrom: string;
  validUntil: string;
  responsible?: PekNamedRef | null;
  responsibleUser?: PekNamedRef | null;
  responsibleUserId?: PekId | null;
  readinessPercent?: number;
  updatedAt?: string;
  availableActions: PekAvailableAction[];
  readOnly: boolean;
  controlItems?: PekControlItem[];
  indicators?: PekIndicator[];
  measures?: PekMeasure[];
  documents?: PekProgramDocument[];
}

export type PekProgramHeaderFields = {
  companyId: number;
  objectId: number;
  number: string;
  name: string;
  description?: string | null;
  validFrom: string;
  validUntil: string;
  responsibleUserId?: number | null;
};
export type PekProgramCreateRequest = PekProgramHeaderFields & {
  controlItems: Omit<PekControlItem, 'clientId'>[];
  indicators: Omit<PekIndicator, 'clientId' | 'controlItemClientId'>[];
  measures: Omit<PekMeasure, 'clientId'>[];
};
export type PekProgramCloneRequest = {
  number: string;
  name?: string;
  validFrom?: string;
  validUntil?: string;
};
export type PekProgramUpdateRequest = Partial<PekProgramHeaderFields> & {
  version?: number;
  controlItems?: Omit<PekControlItem, 'clientId'>[] | null;
  indicators?: Omit<PekIndicator, 'clientId' | 'controlItemClientId'>[] | null;
  measures?: Omit<PekMeasure, 'clientId'>[] | null;
};
/** @deprecated use PekProgramCreateRequest/PekProgramUpdateRequest */
export type PekProgramRequest = PekProgramCreateRequest & { version?: number };

export type PekProgramForm = PekProgramHeaderFields & {
  version?: number;
  controlItems: PekControlItem[];
  indicators: PekIndicator[];
  measures: PekMeasure[];
};
export type PekProgramFilters = {
  search?: string;
  companyId?: number;
  objectId?: number;
  status?: PekProgramStatus;
  activeOn?: string;
  responsibleUserId?: number;
  page?: number;
  size?: number;
  sort?: string;
};

export interface PekReport {
  id: PekId;
  version: number;
  status: PekReportStatus | string;
  periodType: PekPeriodType;
  year: number;
  quarter?: number | null;
  periodStart: string;
  periodEnd: string;
  company?: PekNamedRef | null;
  object?: PekNamedRef | null;
  companyId: number;
  objectId: number;
  programId: number;
  responsibleUser?: PekNamedRef | null;
  linkedProtocolCount: number;
  linkedProtocolNumbers: string[];
  lastCollectedAt?: string | null;
  returnInfo?: {
    reason?: string;
    comment?: string;
    returnedAt?: string;
    returnedBy?: {
      id?: number;
      name?: string;
    };
  } | null;
  availableActions: Record<string, boolean>;
}
export type PekReportFilters = {
  companyId: number;
  objectId: number;
  page?: number;
  size?: number;
};
export type PekReportCreationParams = {
  companyId: number;
  objectId: number;
  periodType: PekPeriodType;
  year: number;
  quarter?: number;
};
export type PekReportCreateRequest = PekReportCreationParams & {
  programId: number;
  collectImmediately: boolean;
};
export interface PekCreationContext {
  company?: PekNamedRef | null;
  object?: PekNamedRef | null;
  periodStart: string;
  periodEnd: string;
  programs: PekProgram[];
  selectedProgramId?: number | null;
  duplicateReportId?: number | null;
  warnings: string[];
  blockingReasons: string[];
}

export interface PekDashboardDeadline {
  id: number;
  type: string;
  date: string;
  description: string;
}
export interface PekDashboard {
  totalReportCount?: number;
  readinessPercent?: number;
  criticalIssueCount?: number;
  overdueRiskCount?: number;
  programExecutionPercent?: number;
  openExceedanceCount?: number;
  overdueActionCount?: number;
  missingProtocolCount?: number;
  returnedReportCount?: number;
  unmatchedSourceCount?: number;
  ambiguousSourceCount?: number;
  staleSourceCount?: number;
  deadlines: PekDashboardDeadline[];
  reports: PekReport[];
}
export type PekDashboardFilters = {
  companyId?: number;
  objectId?: number;
  year?: number;
  quarter?: number;
  status?: PekReportStatus;
  responsibleId?: number;
};

export interface PekHistoryItem {
  id?: number;
  actionType: string;
  actorName?: string | null;
  comment?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt: string;
}
export type PekMutationBody = Record<string, unknown> & { version?: number };
export type PekBlobResult = { blob: Blob; filename: string };
export type PekResultValue = {
  numericValue?: number | null;
  textValue?: string | null;
  rangeFrom?: number | null;
  rangeTo?: number | null;
  belowDetectionLimit?: boolean;
  detectionLimit?: number | null;
};

export type PekApiErrorDetails = {
  code?: string;
  message?: string;
  field?: string;
  details?: unknown;
  correlationId?: string;
};

export type PekValidationIssue = {
  code: string;
  message: string;
  severity: 'BLOCKING' | 'WARNING' | 'INFO' | string;
  section?: string | null;
  entityId?: number | null;
  field?: string | null;
};

export type PekReadiness = {
  ready: boolean;
  completionPercent?: number;
  issues: PekValidationIssue[];
  missingMeasurements?: number;
  unmatchedSources?: number;
  unreviewedMatches?: number;
  openExceedances?: number;
  blockingComments?: number;
  missingCorrectiveActions?: number;
  documentReady?: boolean;
  signatureReady?: boolean;
};

export interface PekCollectResponse {
  report: PekReport;
  linkedProtocolCount: number;
  linkedProtocolNumbers: string[];
  protocolResultCount: number;
  matchedCount: number;
  unmatchedCount: number;
  ambiguousCount: number;
  removedStaleSourceCount: number;
  updatedSourceCount: number;
  warnings: string[];
}

export interface PekReportSource {
  id: number;
  protocolId: number;
  protocolNumber: string;
  protocolResultId: number;
  indicatorName?: string | null;
  unit?: string | null;
  controlItemId?: number | null;
  programIndicatorId?: number | null;
  matchStatus: PekMatchStatus | string;
  matchType?: string | null;
  manual: boolean;
  excluded: boolean;
  exclusionReason?: string | null;
  sourceVersion: number;
  version: number;
  matchReason?: string | null;
  matchedAt?: string | null;
  updatedAt?: string | null;
}

export interface PekReportSourceSummary {
  linkedProtocolCount: number;
  linkedResultCount: number;
  unmatchedResultCount: number;
  ambiguousResultCount: number;
  staleResultCount: number;
  excludedResultCount: number;
}

export interface PekPlanFactItem {
  planFactRowId: number;
  controlItemId: number;
  controlItemName: string;
  indicatorId: number;
  indicatorName: string;
  unit?: string | null;
  plannedCount: number;
  actualCount: number;
  missingCount: number;
  completionPercent: number;
  normativeValue?: number | null;
  comparisonType?: ComparisonType | null;
  bestValue?: number | null;
  worstValue?: number | null;
  averageValue?: number | null;
  hasExceedance: boolean;
  exceedanceCount: number;
  status: string;
}

export interface PekPlanFactResponse {
  summary: { planned: number; completed: number; missing: number; completionPercent: number; exceedances: number };
  items: PekPlanFactItem[];
}

export interface PekReadinessResponse {
  ready: boolean;
  progressPercent: number;
  summary: { planned: number; completed: number; missing: number; unmatched: number; ambiguous: number; stale: number; openExceedances: number; overdueActions: number };
  issues: Array<{ code: string; section: string; severity: string; message: string; blocking: boolean }>;
}

export interface PekSettings {
  companyId: number;
  defaultResponsibleUserId?: number | null;
  defaultLaboratoryId?: number | null;
  defaultResponsibleUser?: { id: number; fullName: string } | null;
  defaultLaboratory?: { id: number; name: string } | null;
  defaultReportType: 'QUARTERLY' | 'YEARLY';
  autoCollectProtocols: boolean;
  includeOnlySignedProtocols: boolean;
  allowFallbackMatching: boolean;
  requireManualAmbiguousConfirmation: boolean;
  requireAllPlanFactItems: boolean;
  blockSubmitWithUnmatchedResults: boolean;
  blockSubmitWithAmbiguousResults: boolean;
  blockSubmitWithStaleSources: boolean;
  blockSubmitWithOpenExceedances: boolean;
  notifyBeforeDeadlineDays: number;
  notifyMissingProtocols: boolean;
  notifyExceedances: boolean;
  notifyReportReturned: boolean;
  version: number;
  availableActions: Record<string, boolean>;
  capabilities: Record<string, boolean>;
}

export type PekSettingsUpdateRequest = Omit<PekSettings, 'companyId' | 'defaultResponsibleUser' | 'defaultLaboratory' | 'availableActions' | 'capabilities'>;

export type PekProgramListItem = PekProgram;
export type PekProgramDetails = PekProgram;
export type PekReportListItem = PekReport;
export type PekReportDetails = PekReport;
