import type { AccessContext, DocumentDetail, DocumentStatus, DocumentTypeConfig, FeatureCode, UsageMetric } from './types';

export const hasFeature = (access: AccessContext | undefined, feature: FeatureCode) =>
  access?.available === true && access.features.includes(feature);

export const hasPermission = (access: AccessContext | undefined, permission: string) =>
  access?.available === true && access.permissions.includes(permission);

export const canMutate = (
  access: AccessContext | undefined,
  permission?: string,
  feature?: FeatureCode,
) => Boolean(
  access?.available
  && !access.readOnly
  && (!permission || hasPermission(access, permission))
  && (!feature || hasFeature(access, feature)),
);

export const isKnownDocumentStatus = (status: string): status is DocumentStatus => [
  'DRAFT', 'READY_FOR_SIGNING', 'SENT_FOR_SIGNING', 'PARTIALLY_SIGNED', 'SIGNED',
  'REJECTED', 'RETURNED_FOR_REVISION', 'REVOCATION_REQUESTED', 'REVOKED',
  'CANCELLED', 'EXPIRED', 'ARCHIVED',
].includes(status);

export const documentMutationAllowed = (document: DocumentDetail, access: AccessContext) =>
  !access.readOnly && isKnownDocumentStatus(document.status);

export const validateDocumentFile = (file: File, config: DocumentTypeConfig): string | null => {
  if (!config.allowedMimeTypes.includes(file.type)) return 'Тип файла не разрешён для выбранного документа.';
  if (file.size > config.maxSizeBytes) return `Размер файла превышает ${Math.ceil(config.maxSizeBytes / 1024 / 1024)} МБ.`;
  return null;
};

export const limitProgress = (access: AccessContext, metric: UsageMetric) => {
  const used = access.usage[metric] ?? 0;
  const limit = access.limits[metric] ?? 0;
  return { used, limit, percent: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0 };
};

export const validateRequiredCount = (requiredCount: number, assignmentsCount: number) =>
  Number.isInteger(requiredCount) && requiredCount >= 1 && requiredCount <= assignmentsCount;
