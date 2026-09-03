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

const viewRoles: UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'MANAGER', 'ACCOUNTANT', 'ECOLOGIST', 'LABORATORY', 'WASTE_SPECIALIST'];
const programEditorRoles: UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST'];
const reportEditorRoles: UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST', 'LABORATORY'];
const supervisorRoles: UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD'];
const submitterRoles: UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST'];
const adminRoles: UserRole[] = ['ADMIN', 'DIRECTOR'];

export const canUsePekPermission = (user: PekUser, permission: string) => {
  const explicit = explicitPermission(user, permission);
  if (explicit !== undefined) return explicit;
  const role = user?.role;
  if (!role) return false;
  if (permission === 'PEK_VIEW' || permission === 'PEK_SETTINGS_VIEW' || permission === 'PEK_REPORT_EXPORT') {
    return user?.companyPermissions?.COMPANY_VIEW === true || viewRoles.includes(role);
  }
  if (permission === 'PEK_PROGRAM_CREATE' || permission === 'PEK_PROGRAM_EDIT') return programEditorRoles.includes(role);
  if (permission === 'PEK_REPORT_CREATE' || permission === 'PEK_REPORT_EDIT' || permission === 'PEK_REPORT_COLLECT' || permission === 'PEK_REPORT_VALIDATE') return reportEditorRoles.includes(role);
  if (permission === 'PEK_PROGRAM_ACTIVATE' || permission === 'PEK_PROGRAM_ARCHIVE' || permission === 'PEK_PROGRAM_REVIEW' || permission === 'PEK_PROGRAM_APPROVE') return supervisorRoles.includes(role);
  if (permission === 'PEK_REPORT_REVIEW' || permission === 'PEK_REPORT_RETURN' || permission === 'PEK_REPORT_APPROVE' || permission === 'PEK_SETTINGS_EDIT') return supervisorRoles.includes(role);
  if (permission === 'PEK_REPORT_SIGN' || permission === 'PEK_REPORT_SUBMIT') return submitterRoles.includes(role);
  if (permission === 'PEK_ADMIN') return adminRoles.includes(role);
  return false;
};

export const canViewPek = (user: PekUser) => {
  return canUsePekPermission(user, 'PEK_VIEW');
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
// the response contains them; role fallback is used only when no such field is
// available and mirrors PekSecurityExpressions.
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
