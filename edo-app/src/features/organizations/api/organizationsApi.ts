import { edoApiClient } from '../../../shared/api/edoApiClient';
import type { OrganizationMembership } from '../../../shared/types/domain';

export const organizationsApi = {
  async list(signal?: AbortSignal) {
    const { data } = await edoApiClient.get<OrganizationMembership[]>('/organizations', { signal });
    return data;
  },
  async activate(organizationId: string) {
    const { data } = await edoApiClient.post<{ activeOrganizationId: string }>('/organizations/active', { organizationId });
    return data;
  },
};
