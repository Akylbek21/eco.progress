import type { AvailableAction } from './types';

export type DocumentAction = AvailableAction | 'SIGN' | 'REJECT' | 'RETURN_FOR_REVISION' | 'REVOKE' | 'VIEW_AUDIT';

export interface ResolvedDocumentActions {
  backendActions: DocumentAction[];
  supportedByFrontend: DocumentAction[];
  unavailableBecauseBackendContract: DocumentAction[];
}

const frontendActions = new Set<DocumentAction>([
  'EDIT', 'DELETE', 'SEND_FOR_SIGNING', 'DOWNLOAD', 'UPLOAD_VERSION', 'ARCHIVE',
  'MANAGE_ATTACHMENTS', 'SIGN', 'REJECT', 'RETURN_FOR_REVISION', 'REVOKE', 'VIEW_AUDIT',
]);

export const resolveDocumentActions = (
  backendActions: AvailableAction[],
  contextExpectedActions: DocumentAction[] = [],
): ResolvedDocumentActions => {
  const returned = [...backendActions] as DocumentAction[];
  return {
    backendActions: returned,
    supportedByFrontend: returned.filter((action) => frontendActions.has(action)),
    unavailableBecauseBackendContract: contextExpectedActions.filter((action) => !returned.includes(action)),
  };
};
