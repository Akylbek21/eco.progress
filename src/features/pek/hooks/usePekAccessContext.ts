import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import { retryPekQuery } from '../utils/pekQueryPolicy';

export const usePekAccessContext = (companyId?: number) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: pekKeys.accessContext(companyId || 0, user?.id),
    queryFn: ({ signal }) => pekApi.getAccessContext(companyId!, signal),
    enabled: Boolean(companyId),
    retry: retryPekQuery,
  });
};

export const hasPekContextPermission = (
  context: ReturnType<typeof usePekAccessContext>['data'],
  permission: string,
) => context?.permissions.includes(permission) === true;
