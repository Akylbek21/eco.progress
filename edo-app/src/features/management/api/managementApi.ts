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

export const managementApi = {
  async list(resource: string, signal?: AbortSignal) {
    const { data } = await edoApiClient.get<PageResult<ManagementItem>>(`/${resource}`, { params: { page: 0, size: 50 }, signal });
    return data;
  },
};
