export type PekProgramStatus = 'DRAFT' | 'UNDER_REVIEW' | 'RETURNED' | 'APPROVED' | 'ACTIVE' | 'ARCHIVED';
export type PekReportStatus =
  | 'DRAFT' | 'COLLECTING' | 'REQUIRES_CORRECTION' | 'READY_FOR_REVIEW'
  | 'UNDER_REVIEW' | 'RETURNED' | 'READY_FOR_APPROVAL' | 'APPROVED'
  | 'READY_FOR_SIGNING' | 'SIGNED' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'ARCHIVED';
export type PekCollectionRunStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';
export type PekSectionCode =
  | 'GENERAL' | 'PROGRAM_EXECUTION' | 'EMISSIONS' | 'CALCULATED_CONTROL'
  | 'WATER' | 'WASTE' | 'IMPACT_MONITORING' | 'ENVIRONMENTAL_ACTIONS'
  | 'EXCEEDANCES' | 'DOCUMENTS' | 'REVIEW';
export type PekIssueSeverity = 'ERROR' | 'WARNING' | 'INFO';
export type PekExceedanceStatus = 'OPEN' | 'ACTION_REQUIRED' | 'IN_PROGRESS' | 'AWAITING_REPEAT_CONTROL' | 'RESOLVED' | 'CANCELLED';
export type PekReviewCommentStatus = 'OPEN' | 'RESOLVED' | 'REOPENED';
export type PekPeriodType = 'QUARTER' | 'YEAR';
export type PekControlEventStatus = 'NOT_STARTED' | 'PARTIAL' | 'COMPLETED' | 'OVERFULFILLED';
export type PekFrequencyType = 'ONCE' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'CUSTOM';
export type PekControlType = 'INSTRUMENTAL' | 'CALCULATED' | 'MONITORING' | 'LABORATORY' | 'WASTE';
export type PekAvailableActionCode =
  | 'EDIT' | 'COLLECT' | 'VALIDATE' | 'SUBMIT_REVIEW' | 'START_REVIEW' | 'RETURN'
  | 'ACCEPT_REVIEW' | 'APPROVE' | 'RECALL_APPROVAL' | 'PREPARE_SIGNING' | 'SIGN'
  | 'REGISTER_SUBMISSION' | 'REGISTER_RESULT' | 'CREATE_REVISION' | 'ARCHIVE'
  | 'CLONE' | 'ACTIVATE' | 'DOWNLOAD_PREVIEW' | 'DOWNLOAD_PDF' | 'DOWNLOAD_XLSX'
  | 'DOWNLOAD_JSON' | 'DOWNLOAD_ZIP' | 'CREATE_PROTOCOL' | 'OPEN_PROTOCOL';

export type ApiResponse<T> = { success?: boolean; message?: string | null; data: T };
export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export type PekId = number;
export type PekNamedRef = { id: PekId; name: string; code?: string; address?: string; bin?: string };
export type PekAvailableAction = {
  code: PekAvailableActionCode;
  label: string;
  enabled: boolean;
  disabledReason?: string | null;
  confirmationRequired?: boolean;
  requiresComment?: boolean;
};
export type PekSectionSummary = {
  code: PekSectionCode;
  label: string;
  applicable: boolean;
  notApplicableReason?: string | null;
  readinessPercent: number;
  errorCount: number;
  warningCount: number;
  completed: boolean;
};
export type PekReportIssue = {
  id: number;
  code: string;
  severity: PekIssueSeverity;
  blocking: boolean;
  sectionCode?: PekSectionCode;
  sectionLabel?: string;
  rowKey?: string;
  fieldPath?: string;
  message: string;
  details?: string;
  source?: string;
  actionCode?: string;
  actionPayload?: Record<string, unknown>;
  resolved: boolean;
};
export type PekProgram = {
  id: PekId;
  number: string;
  name: string;
  version: number;
  status: PekProgramStatus;
  company: PekNamedRef;
  object: PekNamedRef;
  validFrom: string;
  validUntil: string;
  responsible?: PekNamedRef | null;
  readinessPercent?: number;
  updatedAt?: string;
  availableActions: PekAvailableAction[];
  controlItems?: Record<string, unknown>[];
  indicators?: Record<string, unknown>[];
  measures?: Record<string, unknown>[];
  documents?: Record<string, unknown>[];
};
export type PekProgramRequest = {
  companyId: number;
  objectId: number;
  number: string;
  name: string;
  version: number;
  validFrom: string;
  validUntil: string;
  responsibleUserId?: number | null;
  permitId?: number | null;
  controlItems: Record<string, unknown>[];
  indicators: Record<string, unknown>[];
  measures: Record<string, unknown>[];
  reviewerId?: number | null;
  approverId?: number | null;
};
export type PekReport = {
  id: PekId;
  number: string;
  revision: number;
  version: number;
  status: PekReportStatus;
  periodType: PekPeriodType;
  year: number;
  quarter?: number | null;
  periodStart: string;
  periodEnd: string;
  dueDate?: string | null;
  company: PekNamedRef;
  object: PekNamedRef;
  program?: PekNamedRef & { version?: number } | null;
  responsible?: PekNamedRef | null;
  readinessPercent: number;
  valid: boolean;
  latestValidatedVersion?: number | null;
  blockingIssueCount: number;
  warningCount: number;
  exceedanceCount: number;
  sections: PekSectionSummary[];
  availableActions: PekAvailableAction[];
  snapshot?: { id?: number; createdAt?: string; hash?: string } | null;
  signature?: Record<string, unknown> | null;
  originalReportId?: number | null;
  rejectionReason?: string | null;
};
export type PekReportFilters = {
  search?: string; companyId?: number; objectId?: number; periodType?: PekPeriodType;
  year?: number; quarter?: number; status?: PekReportStatus; responsibleId?: number;
  onlyWithErrors?: boolean; onlyOverdue?: boolean; page?: number; size?: number; sort?: string;
};
export type PekProgramFilters = {
  search?: string; companyId?: number; objectId?: number; status?: PekProgramStatus;
  activeOn?: string; page?: number; size?: number; sort?: string;
};
export type PekCreationContext = {
  company: PekNamedRef;
  object: PekNamedRef;
  periodStart: string;
  periodEnd: string;
  programs: PekProgram[];
  selectedProgramId?: number | null;
  duplicateReportId?: number | null;
  warnings: string[];
  blockingReasons: string[];
};
export type PekCollectionRun = {
  id: number;
  status: PekCollectionRunStatus;
  currentCollector?: string;
  progressPercent: number;
  processedRows: number;
  foundIssues: number;
  message?: string;
  traceId?: string;
  collectors?: Array<{ code: string; label: string; status: string; message?: string }>;
};
export type PekDashboard = {
  readinessPercent: number;
  criticalIssueCount: number;
  overdueRiskCount: number;
  programExecutionPercent: number;
  openExceedanceCount: number;
  overdueActionCount: number;
  missingProtocolCount: number;
  deadlines: Array<{ reportId: number; reportNumber: string; dueDate: string; label: string }>;
  reports: Array<{ reportId: number; reportNumber: string; nextAction?: string; responsible?: string }>;
};
export type PekPlanFactRow = {
  id: string;
  controlItem: string;
  source: string;
  frequency: string;
  plannedEvents: number;
  actualEvents: number;
  eventCompletionPercent: number;
  plannedIndicators: number;
  foundIndicators: number;
  indicatorCompletenessPercent: number;
  status: PekControlEventStatus;
  protocolIds: number[];
  issueCount: number;
};
export type PekUnmatchedSource = {
  id: number; protocolId: number; protocolNumber: string; date: string; indicator: string;
  point: string; result: string; reason: string; suggestedControlItem?: string; confidenceLabel?: string;
};
export type PekExceedance = {
  id: number; indicator: string; protocolId?: number; result: string; unit: string;
  normative: string; multiplicity: number; status: PekExceedanceStatus; possibleCause?: string;
  actionDescription?: string; responsible?: string; actionDeadline?: string; repeatControlId?: number;
};
export type PekReviewComment = {
  id: number; status: PekReviewCommentStatus; text: string; mandatory: boolean;
  sectionCode?: PekSectionCode; rowKey?: string; fieldPath?: string; assignee?: PekNamedRef | null;
  author?: PekNamedRef | null; createdAt: string; resolutionComment?: string;
};
export type PekHistoryItem = {
  id: number; occurredAt: string; user?: string; role?: string; action: string;
  comment?: string; oldStatus?: string; newStatus?: string; changedFields?: string[];
};
export type PekMutationBody = Record<string, unknown> & { version?: number };
export type PekBlobResult = { blob: Blob; filename: string };
