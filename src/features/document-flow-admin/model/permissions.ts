import type { User } from '../../../types';

export const canManageDocumentFlowAccess = (user: Pick<User, 'role' | 'permissions'> | null | undefined) =>
  user?.role === 'ADMIN' || user?.permissions?.includes('DOCUMENT_FLOW_ACCESS_MANAGE') === true;

