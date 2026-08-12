import type { UserRole } from '../../../types';

export type PekUser = {
  role?: UserRole;
  permissions?: string[];
} | null | undefined;

const VIEW_ROLES: readonly UserRole[] = [
  'ADMIN', 'DIRECTOR', 'HEAD', 'MANAGER', 'ACCOUNTANT',
  'ECOLOGIST', 'LABORATORY', 'WASTE_SPECIALIST',
];
const EDIT_PROGRAM_ROLES: readonly UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST'];
export const REPORT_EDIT_ROLES: readonly UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST', 'LABORATORY'];
export const REPORT_COLLECT_ROLES: readonly UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST', 'LABORATORY'];
export const REPORT_SUBMIT_ROLES: readonly UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD'];
export const REPORT_APPROVE_ROLES: readonly UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD'];
const REVIEW_ROLES: readonly UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD'];
const ADMIN_ROLES: readonly UserRole[] = ['ADMIN', 'DIRECTOR'];

const roleAllowed = (user: PekUser, roles: readonly UserRole[]) =>
  Boolean(user?.role && roles.includes(user.role));

const explicitPermission = (user: PekUser, permission: string): boolean | undefined => {
  if (!Array.isArray(user?.permissions)) return undefined;
  return user.permissions.includes(permission);
};

const permissionRoles = (permission: string): readonly UserRole[] => {
  switch (permission) {
    case 'PEK_VIEW':
    case 'PEK_PROGRAM_VIEW':
    case 'PEK_REPORT_VIEW':
    case 'PEK_REPORT_EXPORT':
      return VIEW_ROLES;
    case 'PEK_PROGRAM_CREATE':
    case 'PEK_PROGRAM_EDIT':
    case 'PEK_PROGRAM_SUBMIT':
      return EDIT_PROGRAM_ROLES;
    case 'PEK_REPORT_CREATE':
    case 'PEK_REPORT_EDIT':
    case 'PEK_REPORT_MATCH':
    case 'PEK_REPORT_VALIDATE':
      return REPORT_EDIT_ROLES;
    case 'PEK_REPORT_COLLECT':
      return REPORT_COLLECT_ROLES;
    case 'PEK_REPORT_SUBMIT':
    case 'PEK_REPORT_SIGN':
      return REPORT_SUBMIT_ROLES;
    case 'PEK_PROGRAM_APPROVE':
    case 'PEK_PROGRAM_ACTIVATE':
    case 'PEK_PROGRAM_ARCHIVE':
    case 'PEK_REPORT_REVIEW':
    case 'PEK_REPORT_RETURN':
    case 'PEK_REPORT_APPROVE':
    case 'PEK_SETTINGS_EDIT':
      return REVIEW_ROLES;
    case 'PEK_ADMIN':
      return ADMIN_ROLES;
    default:
      return [];
  }
};

/**
 * The current backend UserResponse has no permissions field. In that confirmed
 * contract we mirror the controller's @PreAuthorize role unions. If a future
 * auth response explicitly supplies permissions, that server list wins — an
 * explicit empty array therefore grants nothing.
 */
export const canUsePekPermission = (user: PekUser, permission: string) => {
  const explicit = explicitPermission(user, permission);
  return explicit ?? roleAllowed(user, permissionRoles(permission));
};

// The current auth DTO has no permissions field, so route visibility follows
// the same PEK_VIEW role union enforced by the backend controller.
export const canViewPek = (user: PekUser) => {
  const explicit = explicitPermission(user, 'PEK_VIEW');
  return explicit ?? roleAllowed(user, VIEW_ROLES);
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

const actionAllowed = (report: PekReportAccess, action: string) => resourceFlag(report, action) === true;

export const canEditPekReport = (_user: PekUser, report: PekReportAccess) => actionAllowed(report, 'edit');
export const canCollectPekReport = (_user: PekUser, report: PekReportAccess) => actionAllowed(report, 'collect');
export const canSubmitPekReport = (_user: PekUser, report: PekReportAccess) => actionAllowed(report, 'submitReview');
export const canApprovePekReport = (_user: PekUser, report: PekReportAccess) => actionAllowed(report, 'approve');
export const canReturnPekReport = (_user: PekUser, report: PekReportAccess) => actionAllowed(report, 'returnForRevision');
export const canArchivePekReport = (_user: PekUser, report: PekReportAccess) => actionAllowed(report, 'archive');

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
  resourceFlag(resource, 'manageExceedance', 'canEdit') ?? false;
export const canReviewExceedance = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'reviewExceedance', 'canApprove') ?? false;
export const canGenerateDocument = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'generateDocument') ?? false;
export const canSignReport = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'sign', 'canSign') ?? false;
export const canArchiveReport = (user: PekUser, resource?: PekResourceAccess) =>
  resourceFlag(resource, 'archive', 'canArchive') ?? canUsePekPermission(user, 'PEK_REPORT_APPROVE');

export const canTransitionExceedance = (resource: PekResourceAccess, transition: string) =>
  Array.isArray(resource?.allowedTransitions) && resource.allowedTransitions.includes(transition);

export const pekViewRoles = VIEW_ROLES;
