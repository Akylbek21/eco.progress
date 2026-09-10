import type { CompanyPermission, UserRole } from '../../../types';

export type PekUser = {
  role?: UserRole;
  permissions?: string[];
  companyPermissions?: Partial<Record<CompanyPermission, boolean>>;
} | null | undefined;

const explicitPermission = (user: PekUser, permission: string): boolean | undefined => {
  if (!Array.isArray(user?.permissions)) return undefined;
  return user.permissions.includes(permission);
};

// Resource action flags and explicit permissions are authoritative; never infer grants from roles.
export const canUsePekPermission = (user: PekUser, permission: string) => explicitPermission(user, permission) === true;

export const canViewPek = (user: PekUser) => {
  const explicit = explicitPermission(user, 'PEK_VIEW');
  // The current /auth/me contract does not expose PEK_* permissions. Missing
  // permission data means "unknown", not "denied": the PEK endpoints still
  // enforce PEK_VIEW and company membership. An explicit permission list is
  // authoritative when a newer backend provides it.
  return explicit ?? Boolean(user);
};
export const canEditPek = (user: PekUser) =>
  canUsePekPermission(user, 'PEK_PROGRAM_EDIT') || canUsePekPermission(user, 'PEK_REPORT_EDIT');
export const canReviewPek = (user: PekUser) =>
  canUsePekPermission(user, 'PEK_REPORT_REVIEW');
export const canApprovePek = (user: PekUser) =>
  canUsePekPermission(user, 'PEK_REPORT_APPROVE');
export const canManagePekSettings = (user: PekUser) =>
  canUsePekPermission(user, 'PEK_SETTINGS_EDIT');

export type PekResourceAccess = {
  status?: string;
  availableActions?: Record<string, boolean>;
  allowedTransitions?: readonly string[];
  canEdit?: boolean;
  canSubmit?: boolean;
  canApprove?: boolean;
  canSign?: boolean;
  canArchive?: boolean;
} | null | undefined;
export type PekReportAccess = PekResourceAccess;

const resourceFlag = (
  resource: PekResourceAccess,
  action: string,
  directFlag?: 'canEdit' | 'canSubmit' | 'canApprove' | 'canSign' | 'canArchive',
): boolean | undefined => {
  if (resource?.availableActions && typeof resource.availableActions[action] === 'boolean') return resource.availableActions[action];
  if (directFlag && typeof resource?.[directFlag] === 'boolean') return resource[directFlag];
  return undefined;
};

export const canEditPekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'edit', 'canEdit') === true;
export const canCollectPekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'collect') === true;
export const canSubmitPekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'submitReview', 'canSubmit') === true;
export const canApprovePekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'approve', 'canApprove') === true;
export const canReturnPekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'returnForRevision') === true;
export const canArchivePekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'archive', 'canArchive') === true;

// Central PEK access surface. Resource-level flags are authoritative whenever
// the response contains them; otherwise explicit permissions are required.
export const canCreateProgram = (user: PekUser) => canUsePekPermission(user, 'PEK_PROGRAM_CREATE');
export const canEditProgram = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'edit', 'canEdit') ?? canUsePekPermission(user, 'PEK_PROGRAM_EDIT');
export const canDeleteProgram = (user: PekUser, resource?: { status?: string; availableActions?: { delete?: boolean } }) => {
  if (typeof resource?.availableActions?.delete === 'boolean') return resource.availableActions.delete;
  return resource?.status === 'DRAFT' && canUsePekPermission(user, 'PEK_PROGRAM_EDIT');
};
export const canCreateReport = (user: PekUser) => canUsePekPermission(user, 'PEK_REPORT_CREATE');
export const canRunPekScheduler = (user: PekUser) => canUsePekPermission(user, 'PEK_ADMIN');
export const canCollectResults = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'collect') ?? canUsePekPermission(user, 'PEK_REPORT_COLLECT');
export const canManageExceedance = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'manageExceedance', 'canEdit') ?? canUsePekPermission(user, 'PEK_REPORT_EDIT');
export const canReviewExceedance = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'reviewExceedance', 'canApprove') ?? canUsePekPermission(user, 'PEK_REPORT_REVIEW');
export const canGenerateDocument = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'generateDocument') === true;
export const canSignReport = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'sign', 'canSign') === true;
export const canArchiveReport = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'archive', 'canArchive') === true;

export const canTransitionExceedance = (resource: PekResourceAccess, transition: string) =>
  Array.isArray(resource?.allowedTransitions) && resource.allowedTransitions.includes(transition);
