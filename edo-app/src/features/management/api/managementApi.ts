import { edoApiClient } from '../../../shared/api/edoApiClient';
import type { PageResult } from '../../../shared/types/domain';

export interface ManagementItem {
  id: string;
  title?: string;
  name?: string;
  email?: string;
  status?: string;
  role?: string;
  createdAt?: string;
  availableActions?: string[];
}

// Only 'counterparties' has a real backend list endpoint today
// (GET /api/document-flow/counterparties - CounterpartyController.java:49). 'members',
// 'invitations', 'templates', 'audit', 'revocation-requests' (as a flat list) and every
// 'settings/*' resource have NO backend mapping anywhere in kz.ecoprogress.documentflow - calling
// managementApi.list() with those will always 404 until the corresponding backend endpoints are
// built. See the frontend/backend reconciliation report for the full gap list.
const RESOURCES_WITH_BACKEND_SUPPORT = new Set(['counterparties']);

export const managementApi = {
  async list(resource: string, signal?: AbortSignal) {
    if (!RESOURCES_WITH_BACKEND_SUPPORT.has(resource)) {
      throw new Error(
        `managementApi.list('${resource}'): no backend endpoint exists for this resource yet ` +
          `(see docs/frontend-backend-gaps for the list of unimplemented document-flow features).`,
      );
    }
    const { data } = await edoApiClient.get<PageResult<ManagementItem>>(`/document-flow/${resource}`, {
      params: { page: 0, size: 50 },
      signal,
    });
    return data;
  },
};
