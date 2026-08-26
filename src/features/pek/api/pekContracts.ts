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
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'SIGNED'
  | 'ARCHIVED';
export type PekReportDocumentKind = 'OFFICIAL' | 'INTERNAL_ANALYTICAL';
export type PekReportDocumentFormat = 'docx' | 'pdf' | 'xlsx';
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
export type PekScopeCompany = {
  id: number;
  name: string;
  bin?: string | null;
};
export type PekScopeObject = {
  id: number;
  companyId: number;
  name: string;
  address?: string | null;
  status: 'ACTIVE';
};
export type PekLookupOption = PekNamedRef & {
  description?: string;
  status?: string;
  role?: string;
  validFrom?: string;
  validUntil?: string;
};

export type PekPermitStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';
export type PekPermit = {
  id: PekId;
  companyId: PekId;
  objectId: PekId;
  type: string;
  number: string;
  issuedAt: string | null;
  validFrom: string;
  validTo: string;
  authority: string;
  status: PekPermitStatus;
  effectivelyActive: boolean;
  fileId: string | null;
  note: string | null;
  pekProgramId: PekId | null;
  version: number;
  availableActions?: {
    edit: boolean;
    markExpired: boolean;
    revoke: boolean;
    delete?: boolean;
  };
};
export type PekPermitCreateRequest = {
  companyId: PekId;
  objectId: PekId;
  type: string;
  number: string;
  issuedAt?: string | null;
  validFrom: string;
  validTo: string;
  authority?: string | null;
  note?: string | null;
};
export type PekPermitUpdateRequest = Partial<Omit<PekPermitCreateRequest, 'companyId' | 'objectId'>> & {
  version: number;
};
export type PekPermitStatusRequest = { version: number; status: PekPermitStatus; comment: string };
export type PekPermitHistoryEntry = {
  fromStatus: PekPermitStatus | null;
  toStatus: PekPermitStatus;
  comment: string | null;
  performedBy: { id: PekId; name: string; email: string; position: string | null } | null;
  performedAt: string;
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

export type PekProgramAvailableActions = {
  edit: boolean;
  submit: boolean;
  approve: boolean;
  returnForRevision: boolean;
  activate: boolean;
  archive: boolean;
  clone: boolean;
  uploadDocument: boolean;
};

export type PekReportAvailableActions = {
  collect: boolean;
  manageSources: boolean;
  submitReview: boolean;
  returnForRevision: boolean;
  approve: boolean;
  submit: boolean;
  accept: boolean;
  reject: boolean;
  archive: boolean;
  generateOfficialDocument: boolean;
  previewOfficialDocument: boolean;
  downloadOfficialDocument: boolean;
  signOfficialDocument: boolean;
  generateInternalAnalyticalReport: boolean;
  previewInternalAnalyticalReport: boolean;
  downloadInternalAnalyticalReport: boolean;
  [action: string]: boolean;
};

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
  normativeDocument?: string | null;
  normativeRevision?: string | null;
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
  contentRevision: number;
  regulationVersion: string | null;
  templateVersion: string | null;
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
  availableActions: PekProgramAvailableActions;
  readOnly: boolean;
  readiness?: PekReadiness | null;
  controlItems?: PekControlItem[];
  indicators?: PekIndicator[];
  measures?: PekMeasure[];
  monitoring?: PekProgramMonitoringResponse;
  documents?: PekProgramDocument[];
  facilityInformation?: string | null;
  kato?: string | null;
  bin?: string | null;
  oked?: string | null;
  environmentalCategory?: string | null;
  designCapacity?: string | null;
  actualCapacity?: string | null;
  productionCharacteristics?: string | null;
  monitoringScope?: string | null;
  permitIds?: PekId[];
  readinessNotes?: string | null;
}

export type PekMonitoringType =
  | 'AMBIENT_AIR'
  | 'EMISSION_SOURCE'
  | 'SURFACE_WATER'
  | 'GROUNDWATER'
  | 'WASTEWATER'
  | 'SOIL'
  | 'WASTE'
  | 'PHYSICAL_FACTOR';
export interface PekMonitoringDirection {
  id: number;
  programId: number;
  monitoringType: PekMonitoringType;
  name: string;
  methodology?: string | null;
  laboratoryId?: number | null;
  frequencyType: PekPeriodicity;
  plannedCount: number;
  controlItemIds: number[];
  protocolTypes: string[];
  active: boolean;
  availableActions: Record<string, boolean>;
}
export interface PekProgramMonitoringResponse {
  programId: number;
  programVersion: number;
  contentRevision: number;
  readiness: PekReadiness | null;
  readinessPercent?: number;
  items: PekMonitoringDirection[];
  availableActions: {
    create: boolean;
  };
}
export interface PekMonitoringMutationRequest {
  monitoringType: PekMonitoringType;
  name: string;
  methodology?: string | null;
  laboratoryId?: number | null;
  frequencyType: PekPeriodicity;
  plannedCount: number;
  controlItemIds: number[];
  active: boolean;
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
  regulationVersion?: string | null;
  templateVersion?: string | null;
  facilityInformation?: string | null;
  kato?: string | null;
  bin?: string | null;
  oked?: string | null;
  environmentalCategory?: string | null;
  designCapacity?: string | null;
  actualCapacity?: string | null;
  productionCharacteristics?: string | null;
  monitoringScope?: string | null;
  permitIds?: PekId[];
  readinessNotes?: string | null;
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
  controlItems?: Omit<PekControlItem, 'clientId'>[] | null;
  indicators?: Omit<PekIndicator, 'clientId' | 'controlItemClientId'>[] | null;
  measures?: Omit<PekMeasure, 'clientId'>[] | null;
};
export type PekProgramForm = PekProgramHeaderFields & {
  version?: number;
  contentRevision?: number;
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
  contentRevision: number;
  regulationVersion: string | null;
  templateVersion: string | null;
  status: PekReportStatus | string;
  periodType: PekPeriodType;
  year: number;
  quarter?: number | null;
  periodStart: string;
  periodEnd: string;
  submissionDueDate: string | null;
  submittedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  company?: PekNamedRef | null;
  object?: PekNamedRef | null;
  companyId: number;
  objectId: number;
  programId: number;
  responsibleUser?: PekNamedRef | null;
  linkedProtocolCount: number;
  linkedProtocolNumbers: string[];
  lastCollectedAt?: string | null;
  availableActions: PekReportAvailableActions;
  returnInfo?: {
    reason?: string;
    comment?: string;
    returnedAt?: string;
    returnedBy?: {
      id?: number;
      name?: string;
    };
  } | null;
}
export type PekReportFilters = {
  companyId: number;
  objectId: number;
  programId?: number;
  status?: PekReportStatus;
  issue?: 'OPEN_EXCEEDANCE' | 'UNMATCHED_SOURCE' | 'MISSING_PROTOCOL';
  page?: number;
  size?: number;
  sort?: string;
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
  regulationVersion?: string | null;
  templateVersion?: string | null;
};
export interface PekCreationContext {
  company?: PekNamedRef | null;
  object?: PekNamedRef | null;
  periodStart: string;
  periodEnd: string;
  submissionDueDate: string | null;
  regulationVersion: string | null;
  templateVersion: string | null;
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
  signedReportCount?: number;
  draftReportCount?: number;
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
export type PekBlobResult = { blob: Blob; filename: string };
export interface PekReportPackage {
  id: number;
  reportId: number;
  documentVersion: number;
  sourceContentRevision: number;
  files: string[];
  missingFields: string[];
  generatedAt?: string | null;
  generatedBy?: string | number | PekNamedRef | null;
  downloadAvailable: boolean;
  availableActions: Record<string, boolean>;
  version: number;
}
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
  addedCount: number;
  updatedCount: number;
  reviewRequiredCount: number;
  exceedanceCount: number;
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
  protocolDate?: string | null;
  protocolStatus?: string | null;
  indicatorCode?: string | null;
  value?: number | null;
  valueText?: string | null;
  normativeValue?: number | null;
  comparisonType?: string | null;
  isExceedance?: boolean | null;
  samplingPlace?: string | null;
  measurementDate?: string | null;
  methodology?: string | null;
  laboratoryName?: string | null;
  controlItemName?: string | null;
  programIndicatorName?: string | null;
  createdAt?: string | null;
  availableActions?: {
    match?: boolean;
    exclude?: boolean;
    restore?: boolean;
  };
}

export interface PekReportHistoryEntry {
  action: string;
  fromStatus: string | null;
  toStatus: string;
  comment: string | null;
  performedBy: { id: number; name?: string; fullName?: string; email?: string; position?: string } | null;
  performedAt: string;
  version: number;
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
  period?: string | null;
  directionName?: string | null;
  monitoringPointId?: number | null;
  monitoringPointName?: string | null;
  protocolId?: number | null;
  protocolNumber?: string | null;
  resultValue?: number | string | null;
  measurementPlace?: string | null;
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

export interface PekDocumentVersion {
  id: number;
  version: number;
  documentKind: PekReportDocumentKind;
  regulationVersion: string | null;
  templateVersion: string | null;
  generatedAt: string;
  generatedById?: number;
  generatedByName?: string;
  sourceContentRevision: number;
  currentContentRevision: number;
  stale: boolean;
  hasDocx: boolean;
  hasPdf: boolean;
  hasXlsx: boolean;
  sha256?: string;
}

export interface PekReportSignature {
  id: number;
  reportId: number;
  documentVersionId: number;
  signerUserId: number;
  signedAt: string;
  documentHash?: string | null;
  signatureType?: string | null;
  certificateSubject?: string | null;
  certificateCn?: string | null;
  certificateSerial?: string | null;
  certificateOrganization?: string | null;
  verified: boolean;
}

export interface PekExceedance {
  id: number;
  reportId: number;
  planFactRowId: number;
  protocolId: number;
  protocolResultId: number;
  programIndicatorId: number;
  actualValue?: number | null;
  normativeValue?: number | null;
  comparisonType?: string | null;
  exceedanceRatio?: number | null;
  severity?: string | null;
  status: string;
  comment?: string | null;
  responsibleUserId?: number | null;
  responsibleUser?: { id: number; fullName?: string; name?: string } | null;
  correctiveAction?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  resolutionComment?: string | null;
  evidenceFileIds: string[];
  resolvedAt?: string | null;
  resolution?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  version: number;
  availableActions: Record<string, boolean>;
  allowedTransitions?: string[];
}

export interface PekAssignExceedanceRequest {
  version: number;
  responsibleUserId: number;
  dueDate: string;
  correctiveAction: string;
}

export interface PekTransitionExceedanceRequest {
  version: number;
  status: string;
  comment?: string;
  resolutionComment?: string;
}

export interface PekCorrectiveAction {
  id: number;
  exceedanceId: number;
  description: string;
  responsibleUserId?: number | null;
  dueDate?: string | null;
  status: string;
  version: number;
  availableActions: Record<string, boolean>;
}

export type PekCorrectiveActionCreateRequest = Omit<PekCorrectiveAction, 'id' | 'exceedanceId' | 'status' | 'version' | 'availableActions'>;
export type PekCorrectiveActionUpdateRequest = Partial<PekCorrectiveActionCreateRequest> & { version: number };
export type PekCorrectiveActionTransitionRequest = { version: number; status: string; comment?: string };

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
  availableActions?: {
    edit?: boolean;
    runScheduler?: boolean;
    runSchedulerGlobal?: boolean;
  };
}

export type PekSettingsUpdateRequest = Omit<PekSettings, 'companyId' | 'defaultResponsibleUser' | 'defaultLaboratory' | 'version' | 'availableActions'>;

export interface PekMonitoringPoint {
  id: number;
  monitoringId: number;
  programId: number;
  name: string;
  coordinates?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description: string | null;
  version: number;
}
export type PekMonitoringPointRequest = Pick<PekMonitoringPoint, 'name' | 'description'> & {
  latitude?: number | null;
  longitude?: number | null;
  coordinates?: string | null;
};

export interface PekInternalInspection {
  id: number;
  programId: number;
  plannedDate: string | null;
  actualDate: string | null;
  inspectionType: string | null;
  findings: string | null;
  correctiveActionRequired: boolean;
  responsibleUserId: number | null;
  status: string;
  version: number;
}
export type PekInternalInspectionRequest = Omit<PekInternalInspection, 'id' | 'programId' | 'version'>;

export interface PekMeasurementQa {
  id: number;
  programId: number;
  parameter: string;
  qaProcedure: string | null;
  frequency: string | null;
  responsibleUserId: number | null;
  lastCheckDate: string | null;
  nextCheckDate: string | null;
  version: number;
}
export type PekMeasurementQaRequest = Omit<PekMeasurementQa, 'id' | 'programId' | 'version'>;

export interface PekEmergencyProcedure {
  id: number;
  programId: number;
  scenario: string;
  actions: string | null;
  responsibleUserId: number | null;
  contactPhone: string | null;
  version: number;
}
export type PekEmergencyProcedureRequest = Omit<PekEmergencyProcedure, 'id' | 'programId' | 'version'>;

export interface PekResponsibility {
  id: number;
  programId: number;
  roleLabel: string;
  userId: number | null;
  duties: string | null;
  version: number;
}
export type PekResponsibilityRequest = Omit<PekResponsibility, 'id' | 'programId' | 'version'>;

export type PekStaffTier = 'VIEWER' | 'EDITOR' | 'REVIEWER';
export type PekStaffStatus = 'ACTIVE' | 'INACTIVE';
export interface PekStaffAssignment {
  id: number;
  companyId: number;
  userId: number;
  userFullName: string;
  userEmail: string;
  tier: PekStaffTier;
  status: PekStaffStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}
export type PekStaffAssignmentCreateRequest = { email: string; tier: PekStaffTier };
export type PekStaffAssignmentUpdateRequest = { tier?: PekStaffTier; status?: PekStaffStatus };

export type PekProgramListItem = PekProgram;
export type PekProgramDetails = PekProgram;
export type CreatePekProgramRequest = PekProgramCreateRequest;
export type UpdatePekProgramRequest = PekProgramUpdateRequest;
export type PekProgramResponse = PekProgram;
export type PekReportListItem = PekReport;
export type PekReportDetails = PekReport;
