import type { DocumentFlowAccess, DocumentFlowFeature, DocumentFlowPermission } from '../types';

export const hasDocumentFlowPermission = (
  access: DocumentFlowAccess | null | undefined,
  permission: DocumentFlowPermission,
) => Boolean(access?.permissions.includes(permission));

export const hasDocumentFlowFeature = (
  access: DocumentFlowAccess | null | undefined,
  feature: DocumentFlowFeature,
) => Boolean(access?.features.includes(feature));

export const hasDocumentFlowAction = (
  access: DocumentFlowAccess | null | undefined,
  action: string,
) => Boolean(access?.availableActions.includes(action));

export const usagePercent = (used?: number, limit?: number) => {
  if (used === undefined || limit === undefined || limit <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
};

export const canMutateDocumentFlow = (access: DocumentFlowAccess | null | undefined) =>
  Boolean(access?.available && !access.readOnly && ['ACTIVE', 'TRIAL', 'GRACE_PERIOD'].includes(access.status));

export const accessDestination = (access: DocumentFlowAccess) => {
  if (access.status === 'NO_SUBSCRIPTION' || access.status === 'FEATURE_DISABLED') return '/document-flow/access-required';
  if (access.status === 'SUSPENDED') return '/document-flow/access-expired';
  if (access.available || access.readOnly || access.status === 'EXPIRED' || access.status === 'READ_ONLY') {
    return '/document-flow/app/dashboard';
  }
  return '/document-flow/access-required';
};

