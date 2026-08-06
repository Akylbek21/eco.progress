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
const EDIT_REPORT_ROLES: readonly UserRole[] = ['ADMIN', 'DIRECTOR', 'HEAD', 'ECOLOGIST', 'LABORATORY'];
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
    case 'PEK_REPORT_COLLECT':
    case 'PEK_REPORT_MATCH':
    case 'PEK_REPORT_VALIDATE':
    case 'PEK_REPORT_SUBMIT':
    case 'PEK_REPORT_SIGN':
      return EDIT_REPORT_ROLES;
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

export const pekViewRoles = VIEW_ROLES;

