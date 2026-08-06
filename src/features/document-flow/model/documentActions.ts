import type { AvailableAction, DocumentDetail, DocumentListItem } from './types';

export type DocumentAction = AvailableAction;

export const hasDocumentAction = (
  document: Pick<DocumentDetail | DocumentListItem, 'availableActions'> | null | undefined,
  action: DocumentAction,
) => Boolean(document?.availableActions.includes(action));

export interface ResolvedDocumentActions {
  backendActions: DocumentAction[];
  supportedByFrontend: DocumentAction[];
  unavailableBecauseBackendContract: DocumentAction[];
}

const frontendActions = new Set<DocumentAction>([
  'VIEW', 'EDIT', 'DELETE', 'UPLOAD_VERSION', 'MANAGE_ROUTE', 'SEND', 'SIGN', 'REJECT',
  'RETURN_FOR_REVISION', 'DOWNLOAD_SIGNED_PACKAGE', 'VIEW_AUDIT', 'CREATE_REVOCATION',
  'APPROVE_REVOCATION', 'REJECT_REVOCATION', 'CANCEL_REVOCATION', 'ARCHIVE', 'MANAGE_ATTACHMENTS',
]);

export const resolveDocumentActions = (
  backendActions: AvailableAction[],
  contextExpectedActions: DocumentAction[] = [],
): ResolvedDocumentActions => ({
  backendActions: [...backendActions],
  supportedByFrontend: backendActions.filter((action) => frontendActions.has(action)),
  unavailableBecauseBackendContract: contextExpectedActions.filter((action) => !backendActions.includes(action)),
});
