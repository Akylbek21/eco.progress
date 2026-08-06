import type { ProtocolPermissions } from '../../../types/protocols';

const permissionKeys = [
  'canView', 'canEdit', 'canDelete', 'canCalculate', 'canCheckNormatives',
  'canGeneratePreview', 'canSendToApproval', 'canReturnForRevision', 'canApprove',
  'canSign', 'canCreateCorrection', 'canCancel', 'canArchive', 'canPublish',
  'canGenerateDocuments', 'canRegenerateDocuments',
] as const satisfies readonly (keyof ProtocolPermissions)[];

/** Fail-closed boundary: only literal backend true values enable an action. */
export const mapProtocolPermissions = (input: unknown): ProtocolPermissions => {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return Object.fromEntries(permissionKeys.map((key) => [key, source[key] === true])) as ProtocolPermissions;
};
