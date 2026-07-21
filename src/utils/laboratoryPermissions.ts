import type { LaboratoryDetails, LaboratoryListItem } from '../types/laboratories';

type UserLike = { role?: string | null } | string | null | undefined;
type LaboratoryLike = Pick<LaboratoryListItem, 'archived' | 'active'> | LaboratoryDetails | null | undefined;
const roleOf = (user: UserLike) => String(typeof user === 'string' ? user : user?.role || '').toUpperCase();
const VIEW = new Set(['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY']);
const CREATE = new Set(['ADMIN', 'DIRECTOR']);
const EDIT = new Set(['ADMIN', 'DIRECTOR', 'HEAD']);
const OWNER = new Set(['ADMIN', 'DIRECTOR']);
const mutable = (laboratory: LaboratoryLike) => !laboratory || (!laboratory.archived && laboratory.active !== false);

export const canViewLaboratories = (user: UserLike) => VIEW.has(roleOf(user));
export const canCreateLaboratory = (user: UserLike) => CREATE.has(roleOf(user));
export const canEditLaboratory = (user: UserLike, laboratory?: LaboratoryLike) => EDIT.has(roleOf(user)) && mutable(laboratory);
export const canEditAccreditation = (user: UserLike, laboratory?: LaboratoryLike) => OWNER.has(roleOf(user)) && mutable(laboratory);
export const canUploadLogo = canEditAccreditation;
export const canManageEmployees = (user: UserLike, laboratory?: LaboratoryLike) => EDIT.has(roleOf(user)) && mutable(laboratory);
export const canSetDefaultLaboratory = (user: UserLike, laboratory?: LaboratoryLike) => OWNER.has(roleOf(user)) && mutable(laboratory);
export const canArchiveLaboratory = (user: UserLike, laboratory?: LaboratoryLike) => OWNER.has(roleOf(user)) && mutable(laboratory);
export const canRestoreLaboratory = (user: UserLike, laboratory?: LaboratoryLike) => OWNER.has(roleOf(user)) && Boolean(laboratory?.archived || laboratory?.active === false);

export const getLaboratoryPermissions = (user: UserLike, laboratory?: LaboratoryLike) => ({
  canView: canViewLaboratories(user),
  canCreate: canCreateLaboratory(user),
  canEdit: canEditLaboratory(user, laboratory),
  canEditAccreditation: canEditAccreditation(user, laboratory),
  canUploadLogo: canUploadLogo(user, laboratory),
  canManageEmployees: canManageEmployees(user, laboratory),
  canSetDefault: canSetDefaultLaboratory(user, laboratory),
  canArchive: canArchiveLaboratory(user, laboratory),
  canRestore: canRestoreLaboratory(user, laboratory),
});
