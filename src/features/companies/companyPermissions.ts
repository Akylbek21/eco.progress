import type { CompanyPermission, User } from '../../types';
import type { CompanyStatus } from '../../types/companies';

export type CompanyPermissionAction = CompanyPermission;

/** Company access is defined exclusively by the effective permissions returned by /api/auth/me. */
export const hasCompanyPermission = (
  user: Pick<User, 'companyPermissions'> | null | undefined,
  permission: CompanyPermissionAction,
): boolean => user?.companyPermissions?.[permission] === true;

export const canOpenCompanyEditor = (
  user: Pick<User, 'companyPermissions'> | null | undefined,
  status: CompanyStatus,
): boolean => status === 'ACTIVE' && hasCompanyPermission(user, 'COMPANY_EDIT');
