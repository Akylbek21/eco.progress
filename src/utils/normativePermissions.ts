type NormativeUser = { role?: string | null } | null | undefined;

const viewRoles = new Set(['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY', 'MANAGER']);
const manageRoles = new Set(['ADMIN', 'DIRECTOR', 'HEAD']);
const roleOf = (user: NormativeUser | string) => String(typeof user === 'string' ? user : user?.role || '').trim().toUpperCase();

export const canViewNormatives = (user: NormativeUser | string) => viewRoles.has(roleOf(user));
export const canCreateNormative = (user: NormativeUser | string) => manageRoles.has(roleOf(user));
export const canEditNormative = canCreateNormative;
export const canArchiveNormative = canCreateNormative;
export const canPreviewNormativeImport = canCreateNormative;
export const canConfirmNormativeImport = canCreateNormative;
export const canReplaceNormativeDocument = (user: NormativeUser | string) => roleOf(user) === 'ADMIN';
export const canRollbackNormativeImport = canReplaceNormativeDocument;

export const getNormativePermissions = (user: NormativeUser | string) => ({
  canView: canViewNormatives(user),
  canCreate: canCreateNormative(user),
  canEdit: canEditNormative(user),
  canArchive: canArchiveNormative(user),
  canPreviewImport: canPreviewNormativeImport(user),
  canConfirmImport: canConfirmNormativeImport(user),
  canReplaceDocument: canReplaceNormativeDocument(user),
  canRollbackImport: canRollbackNormativeImport(user),
});
