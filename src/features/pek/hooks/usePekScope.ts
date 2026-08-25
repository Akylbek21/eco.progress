import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import type { PekScopeCompany } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const uniqueRefs = (values: Array<PekScopeCompany | null | undefined>) => {
  const map = new Map<number, PekScopeCompany>();
  values.forEach((value) => {
    if (value?.id && !map.has(Number(value.id))) map.set(Number(value.id), { ...value, id: Number(value.id) });
  });
  return [...map.values()].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
};

export const usePekScope = (companyId?: number) => {
  const { user } = useAuth();
  const availableCompanies = useQuery({
    queryKey: pekKeys.scope(user?.id),
    queryFn: ({ signal }) => pekApi.getScopeCompanies(signal),
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const companies = useMemo(() => uniqueRefs(availableCompanies.data || []), [availableCompanies.data]);
  const companyAllowed = Boolean(companyId && companies.some((company) => company.id === companyId));
  const objects = useQuery({
    queryKey: pekKeys.scopeCompany(companyId || 0, user?.id),
    queryFn: ({ signal }) => pekApi.getScopeCompanyObjects(companyId!, signal),
    enabled: companyAllowed,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  return { companies, objects, companyAllowed, availableCompanies };
};
