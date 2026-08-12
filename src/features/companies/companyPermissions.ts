import type { User } from '../../types';
import type { CompanyStatus } from '../../types/companies';

export type CompanyPermissionAction =
  | 'read'
  | 'create'
  | 'edit'
  | 'archive'
  | 'readObjects'
  | 'createObjects'
  | 'editObjects'
  | 'archiveObjects';

const permissionAliases: Record<CompanyPermissionAction, readonly string[]> = {
  read: ['COMPANY_VIEW', 'view_companies'],
  create: ['COMPANY_CREATE', 'create_companies'],
  edit: ['COMPANY_EDIT', 'edit_companies'],
  archive: ['COMPANY_ARCHIVE', 'archive_companies'],
  readObjects: ['COMPANY_OBJECT_VIEW', 'view_company_objects', 'COMPANY_VIEW', 'view_companies'],
  createObjects: ['COMPANY_OBJECT_CREATE', 'create_company_objects', 'COMPANY_EDIT', 'edit_companies'],
  editObjects: ['COMPANY_OBJECT_EDIT', 'edit_company_objects', 'COMPANY_EDIT', 'edit_companies'],
  archiveObjects: ['COMPANY_OBJECT_ARCHIVE', 'archive_company_objects', 'COMPANY_ARCHIVE', 'archive_companies'],
};

/** Company access is defined exclusively by the effective permissions returned by /api/auth/me. */
export const hasCompanyPermission = (
  user: Pick<User, 'permissions'> | null | undefined,
  action: CompanyPermissionAction,
): boolean => {
  if (!Array.isArray(user?.permissions)) return false;
  const granted = new Set(user.permissions);
  return permissionAliases[action].some((permission) => granted.has(permission));
};

export const canOpenCompanyEditor = (
  user: Pick<User, 'permissions'> | null | undefined,
  status: CompanyStatus,
): boolean => status === 'ACTIVE' && hasCompanyPermission(user, 'edit');
