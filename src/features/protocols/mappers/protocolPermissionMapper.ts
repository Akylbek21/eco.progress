import type { ProtocolPermissions } from '../../../types/protocols';

const permissionKeys = [
  'canView', 'canEdit', 'canDelete', 'canCalculate', 'canCheckNormatives',
  'canGeneratePreview', 'canSendToApproval', 'canReturnForRevision', 'canApprove',
  'canSign', 'canCreateCorrection', 'canCancel', 'canArchive', 'canPublish',
  'canGenerateDocuments', 'canRegenerateDocuments',
] as const satisfies readonly (keyof ProtocolPermissions)[];

const actionAliases: Partial<Record<string, keyof ProtocolPermissions>> = {
  VIEW: 'canView', EDIT: 'canEdit', DELETE: 'canDelete', CALCULATE: 'canCalculate',
  CHECK_NORMATIVES: 'canCheckNormatives', PREVIEW: 'canGeneratePreview',
  READY_FOR_APPROVAL: 'canSendToApproval', RETURN_FOR_REVISION: 'canReturnForRevision',
  APPROVE: 'canApprove', SIGN: 'canSign', CORRECTION: 'canCreateCorrection',
  CANCEL: 'canCancel', ARCHIVE: 'canArchive', PUBLISH: 'canPublish',
  GENERATE_DOCUMENTS: 'canGenerateDocuments', REGENERATE_DOCUMENTS: 'canRegenerateDocuments',
};

/** Fail-closed boundary: only literal backend true values enable an action. */
export const mapProtocolPermissions = (input: unknown): ProtocolPermissions => {
  if (Array.isArray(input)) {
    const enabled = new Set(input.map((value) => actionAliases[String(value).trim().replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()]).filter(Boolean));
    return Object.fromEntries(permissionKeys.map((key) => [key, enabled.has(key)])) as ProtocolPermissions;
  }
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return Object.fromEntries(permissionKeys.map((key) => [key, source[key] === true])) as ProtocolPermissions;
};
