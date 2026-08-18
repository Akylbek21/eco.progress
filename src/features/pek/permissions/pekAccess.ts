import type { UserRole } from '../../../types';

export type PekUser = {
  role?: UserRole;
  permissions?: string[];
} | null | undefined;

const VIEW_ROLES: readonly UserRole[] = [
  'ADMIN', 'DIRECTOR', 'HEAD', 'MANAGER', 'ACCOUNTANT',
  'ECOLOGIST', 'LABORATORY', 'WASTE_SPECIALIST',
];
const explicitPermission = (user: PekUser, permission: string): boolean | undefined => {
  if (!Array.isArray(user?.permissions)) return undefined;
  return user.permissions.includes(permission);
};

export const canUsePekPermission = (user: PekUser, permission: string) => {
  const explicit = explicitPermission(user, permission);
  return explicit === true;
};

// The current auth DTO has no permissions field, so route visibility follows
// the same PEK_VIEW role union enforced by the backend controller.
export const canViewPek = (user: PekUser) => {
  const explicit = explicitPermission(user, 'PEK_VIEW');
  return explicit === true;
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
  if (resource?.availableActions !== undefined) return resource.availableActions[action] === true;
  if (directFlag && typeof resource?.[directFlag] === 'boolean') return resource[directFlag];
  return undefined;
};

export const canEditPekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'edit', 'canEdit') ?? canUsePekPermission(user, 'PEK_REPORT_EDIT');
export const canCollectPekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'collect') ?? canUsePekPermission(user, 'PEK_REPORT_COLLECT');
export const canSubmitPekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'submitReview', 'canSubmit') ?? canUsePekPermission(user, 'PEK_REPORT_SUBMIT');
export const canApprovePekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'approve', 'canApprove') ?? canUsePekPermission(user, 'PEK_REPORT_APPROVE');
export const canReturnPekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'returnForRevision') ?? canUsePekPermission(user, 'PEK_REPORT_RETURN');
export const canArchivePekReport = (user: PekUser, report: PekReportAccess) =>
  resourceFlag(report, 'archive', 'canArchive') ?? canUsePekPermission(user, 'PEK_REPORT_APPROVE');

// Central PEK access surface. Resource-level flags are authoritative whenever
// the response contains them; role fallback is used only when no such field is
// available and mirrors PekSecurityExpressions.
export const canCreateProgram = (user: PekUser) => canUsePekPermission(user, 'PEK_PROGRAM_CREATE');
export const canEditProgram = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'edit', 'canEdit') ?? canUsePekPermission(user, 'PEK_PROGRAM_EDIT');
export const canCreateReport = (user: PekUser) => canUsePekPermission(user, 'PEK_REPORT_CREATE');
export const canCollectResults = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'collect') ?? canUsePekPermission(user, 'PEK_REPORT_COLLECT');
export const canManageExceedance = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'manageExceedance', 'canEdit') ?? canUsePekPermission(user, 'PEK_REPORT_EDIT');
export const canReviewExceedance = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'reviewExceedance', 'canApprove') ?? canUsePekPermission(user, 'PEK_REPORT_REVIEW');
export const canGenerateDocument = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'generateDocument') ?? canUsePekPermission(user, 'PEK_REPORT_EDIT');
export const canSignReport = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'sign', 'canSign') ?? canUsePekPermission(user, 'PEK_REPORT_SIGN');
export const canArchiveReport = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'archive', 'canArchive') ?? canUsePekPermission(user, 'PEK_REPORT_APPROVE');

export const canTransitionExceedance = (resource: PekResourceAccess, transition: string) =>
  Array.isArray(resource?.allowedTransitions) && resource.allowedTransitions.includes(transition);

export const pekViewRoles = VIEW_ROLES;
