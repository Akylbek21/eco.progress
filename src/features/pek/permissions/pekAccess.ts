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

const ROLE_PERMISSIONS: Partial<Record<UserRole, readonly string[]>> = {
  ADMIN: ['PEK_VIEW', 'PEK_PROGRAM_CREATE', 'PEK_PROGRAM_EDIT', 'PEK_PROGRAM_ACTIVATE', 'PEK_PROGRAM_ARCHIVE', 'PEK_REPORT_CREATE', 'PEK_REPORT_EDIT', 'PEK_REPORT_COLLECT', 'PEK_REPORT_VALIDATE', 'PEK_REPORT_REVIEW', 'PEK_REPORT_RETURN', 'PEK_REPORT_APPROVE', 'PEK_REPORT_SIGN', 'PEK_REPORT_SUBMIT', 'PEK_REPORT_EXPORT', 'PEK_ADMIN', 'PEK_SETTINGS_EDIT'],
  DIRECTOR: ['PEK_VIEW', 'PEK_PROGRAM_CREATE', 'PEK_PROGRAM_EDIT', 'PEK_PROGRAM_ACTIVATE', 'PEK_PROGRAM_ARCHIVE', 'PEK_REPORT_CREATE', 'PEK_REPORT_EDIT', 'PEK_REPORT_COLLECT', 'PEK_REPORT_VALIDATE', 'PEK_REPORT_REVIEW', 'PEK_REPORT_RETURN', 'PEK_REPORT_APPROVE', 'PEK_REPORT_SIGN', 'PEK_REPORT_SUBMIT', 'PEK_REPORT_EXPORT', 'PEK_ADMIN', 'PEK_SETTINGS_EDIT'],
  HEAD: ['PEK_VIEW', 'PEK_PROGRAM_CREATE', 'PEK_PROGRAM_EDIT', 'PEK_PROGRAM_ACTIVATE', 'PEK_PROGRAM_ARCHIVE', 'PEK_REPORT_CREATE', 'PEK_REPORT_EDIT', 'PEK_REPORT_COLLECT', 'PEK_REPORT_VALIDATE', 'PEK_REPORT_REVIEW', 'PEK_REPORT_RETURN', 'PEK_REPORT_APPROVE', 'PEK_REPORT_SIGN', 'PEK_REPORT_SUBMIT', 'PEK_REPORT_EXPORT'],
  ECOLOGIST: ['PEK_VIEW', 'PEK_PROGRAM_CREATE', 'PEK_PROGRAM_EDIT', 'PEK_REPORT_CREATE', 'PEK_REPORT_EDIT', 'PEK_REPORT_COLLECT', 'PEK_REPORT_VALIDATE', 'PEK_REPORT_SIGN', 'PEK_REPORT_EXPORT'],
  LABORATORY: ['PEK_VIEW', 'PEK_REPORT_CREATE', 'PEK_REPORT_EDIT', 'PEK_REPORT_COLLECT', 'PEK_REPORT_VALIDATE', 'PEK_REPORT_EXPORT'],
  MANAGER: ['PEK_VIEW', 'PEK_REPORT_EXPORT'],
  ACCOUNTANT: ['PEK_VIEW', 'PEK_REPORT_EXPORT'],
  WASTE_SPECIALIST: ['PEK_VIEW', 'PEK_REPORT_EXPORT'],
};

const roleHasPermission = (user: PekUser, permission: string) =>
  Boolean(user?.role && ROLE_PERMISSIONS[user.role]?.includes(permission));

export const canUsePekPermission = (user: PekUser, permission: string) => {
  const explicit = explicitPermission(user, permission);
  if (explicit === true || roleHasPermission(user, permission)) return true;
  if (permission === 'PEK_VIEW') return user?.companyPermissions?.COMPANY_VIEW === true;
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
  resourceFlag(report, 'edit', 'canEdit') ?? canUsePekPermission(user, 'PEK_REPORT_EDIT');
export const canCollectPekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'collect') ?? (['DRAFT', 'COLLECTING', 'RETURNED'].includes(report?.status || '') && canUsePekPermission(user, 'PEK_REPORT_COLLECT'));
export const canSubmitPekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'submitReview', 'canSubmit') ?? (['DRAFT', 'RETURNED'].includes(report?.status || '') && canUsePekPermission(user, 'PEK_REPORT_SUBMIT'));
export const canApprovePekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'approve', 'canApprove') ?? (report?.status === 'READY_FOR_REVIEW' && canUsePekPermission(user, 'PEK_REPORT_APPROVE'));
export const canReturnPekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'returnForRevision') ?? (report?.status === 'READY_FOR_REVIEW' && canUsePekPermission(user, 'PEK_REPORT_RETURN'));
export const canArchivePekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'archive', 'canArchive') ?? (['APPROVED', 'SIGNED'].includes(report?.status || '') && canUsePekPermission(user, 'PEK_REPORT_APPROVE'));

// Central PEK access surface. Resource-level flags are authoritative whenever
// the response contains them; role fallback is used only when no such field is
// available and mirrors PekSecurityExpressions.
export const canCreateProgram = (user: PekUser) => canUsePekPermission(user, 'PEK_PROGRAM_CREATE');
export const canEditProgram = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'edit', 'canEdit') ?? canUsePekPermission(user, 'PEK_PROGRAM_EDIT');
export const canCreateReport = (user: PekUser) => canUsePekPermission(user, 'PEK_REPORT_CREATE');
export const canManagePekMemberships = (user: PekUser) => canUsePekPermission(user, 'PEK_ADMIN');
export const canRunPekScheduler = (user: PekUser) => canUsePekPermission(user, 'PEK_ADMIN');
export const canCollectResults = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'collect') ?? canUsePekPermission(user, 'PEK_REPORT_COLLECT');
export const canManageExceedance = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'manageExceedance', 'canEdit') ?? canUsePekPermission(user, 'PEK_REPORT_EDIT');
export const canReviewExceedance = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'reviewExceedance', 'canApprove') ?? canUsePekPermission(user, 'PEK_REPORT_REVIEW');
export const canGenerateDocument = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'generateDocument') ?? (!['SIGNED', 'ARCHIVED'].includes(resource?.status || '') && canUsePekPermission(user, 'PEK_REPORT_EDIT'));
export const canSignReport = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'sign', 'canSign') ?? (['APPROVED', 'READY_FOR_SIGNING', 'PARTIALLY_SIGNED'].includes(resource?.status || '') && canUsePekPermission(user, 'PEK_REPORT_SIGN'));
export const canArchiveReport = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'archive', 'canArchive') ?? canUsePekPermission(user, 'PEK_REPORT_APPROVE');

export const canTransitionExceedance = (resource: PekResourceAccess, transition: string) =>
  Array.isArray(resource?.allowedTransitions) && resource.allowedTransitions.includes(transition);
