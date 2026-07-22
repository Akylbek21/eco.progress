import type { Laboratory } from '../types/laboratories';
type UserLike = { role?: string | null } | string | null | undefined;
const roleOf = (user: UserLike) => String(typeof user === 'string' ? user : user?.role || '').toUpperCase();
const READ = new Set(['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY']);
const CREATE = new Set(['ADMIN', 'DIRECTOR']);
const EDIT = new Set(['ADMIN', 'DIRECTOR', 'HEAD']);
const OWNER = new Set(['ADMIN', 'DIRECTOR']);
const mutable = (laboratory?: Laboratory | null) => !laboratory || laboratory.active;

export const canReadLaboratories = (user: UserLike) => READ.has(roleOf(user));
export const canCreateLaboratory = (user: UserLike) => CREATE.has(roleOf(user));
export const canEditLaboratory = (user: UserLike, laboratory?: Laboratory | null) => EDIT.has(roleOf(user)) && mutable(laboratory);
export const canDeactivateLaboratory = (user: UserLike, laboratory?: Laboratory | null) => OWNER.has(roleOf(user)) && Boolean(laboratory?.active);
export const canSetDefaultLaboratory = (user: UserLike) => OWNER.has(roleOf(user));
export const canManageLaboratoryEmployees = (user: UserLike, laboratory?: Laboratory | null) => EDIT.has(roleOf(user)) && mutable(laboratory);
export const canUploadLaboratoryLogo = (user: UserLike, laboratory?: Laboratory | null) => OWNER.has(roleOf(user)) && mutable(laboratory);

export const canViewLaboratories = canReadLaboratories;
export const canEditAccreditation = (user: UserLike, laboratory?: Laboratory | null) => OWNER.has(roleOf(user)) && mutable(laboratory);
export const canUploadLogo = canUploadLaboratoryLogo;
export const canManageEmployees = canManageLaboratoryEmployees;
export const canArchiveLaboratory = canDeactivateLaboratory;
export const canRestoreLaboratory = (user: UserLike, laboratory?: Laboratory | null) => OWNER.has(roleOf(user)) && Boolean(laboratory && !laboratory.active);
export const getLaboratoryPermissions = (user: UserLike, laboratory?: Laboratory | null) => ({
  canView: canReadLaboratories(user), canCreate: canCreateLaboratory(user), canEdit: canEditLaboratory(user, laboratory), canEditAccreditation: canEditAccreditation(user, laboratory), canUploadLogo: canUploadLaboratoryLogo(user, laboratory), canManageEmployees: canManageLaboratoryEmployees(user, laboratory), canSetDefault: canSetDefaultLaboratory(user), canArchive: canDeactivateLaboratory(user, laboratory), canRestore: canRestoreLaboratory(user, laboratory),
});
