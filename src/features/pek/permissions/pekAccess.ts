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
export const REPORT_SUBMIT_ROLES: readonly UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST'];
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
  if (explicit !== undefined) return explicit;
  return roleAllowed(user, permissionRoles(permission));
};

export const canViewPek = (user: PekUser) => canUsePekPermission(user, 'PEK_VIEW');
export const canEditPek = (user: PekUser) =>
  canUsePekPermission(user, 'PEK_PROGRAM_EDIT') || canUsePekPermission(user, 'PEK_REPORT_EDIT');
export const canReviewPek = (user: PekUser) =>
  canUsePekPermission(user, 'PEK_REPORT_REVIEW');
export const canApprovePek = (user: PekUser) =>
  canUsePekPermission(user, 'PEK_REPORT_APPROVE');
export const canManagePekSettings = (user: PekUser) =>
  canUsePekPermission(user, 'PEK_SETTINGS_EDIT');

export type PekReportAccess = { status?: string; availableActions?: Record<string, boolean> } | null | undefined;
const actionAllowed = (report: PekReportAccess, action: string, statuses: readonly string[]) =>
  report?.availableActions?.[action] === true && Boolean(report.status && statuses.includes(report.status));

export const canEditPekReport = (user: PekUser, report: PekReportAccess) =>
  canUsePekPermission(user, 'PEK_REPORT_EDIT') && actionAllowed(report, 'edit', ['DRAFT', 'COLLECTING', 'RETURNED']);
export const canCollectPekReport = (user: PekUser, report: PekReportAccess) =>
  canUsePekPermission(user, 'PEK_REPORT_COLLECT') && actionAllowed(report, 'collect', ['DRAFT', 'COLLECTING', 'RETURNED']);
export const canSubmitPekReport = (user: PekUser, report: PekReportAccess) =>
  canUsePekPermission(user, 'PEK_REPORT_SUBMIT') && actionAllowed(report, 'submitReview', ['COLLECTING', 'RETURNED']);
export const canApprovePekReport = (user: PekUser, report: PekReportAccess) =>
  canUsePekPermission(user, 'PEK_REPORT_APPROVE') && actionAllowed(report, 'approve', ['READY_FOR_REVIEW']);
export const canReturnPekReport = (user: PekUser, report: PekReportAccess) =>
  canUsePekPermission(user, 'PEK_REPORT_RETURN') && actionAllowed(report, 'returnForRevision', ['READY_FOR_REVIEW']);
export const canArchivePekReport = (user: PekUser, report: PekReportAccess) =>
  canUsePekPermission(user, 'PEK_REPORT_APPROVE') && actionAllowed(report, 'archive', ['APPROVED']);

export const pekViewRoles = VIEW_ROLES;
