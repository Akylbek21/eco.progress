import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { getActiveCompanies, getCompanyObjects } from '../../../services/companyService';
import type { PekNamedRef } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const uniqueRefs = (values: Array<PekNamedRef | null | undefined>) => {
  const map = new Map<number, PekNamedRef>();
  values.forEach((value) => {
    if (value?.id && !map.has(Number(value.id))) map.set(Number(value.id), { ...value, id: Number(value.id) });
  });
  return [...map.values()].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
};

/** The regular CRM company endpoint is the backend source of the current user's company scope. */
export const usePekScope = (companyId?: number) => {
  const { user } = useAuth();
  const availableCompanies = useQuery({
    queryKey: pekKeys.scope(user?.id),
    queryFn: ({ signal }) => getActiveCompanies(signal),
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const companies = useMemo(() => uniqueRefs((availableCompanies.data || []).map((company) => ({
    id: Number(company.id),
    name: company.name,
  }))), [availableCompanies.data]);
  const companyAllowed = Boolean(companyId && companies.some((company) => company.id === companyId));
  const objects = useQuery({
    queryKey: [...pekKeys.scopeCompany(companyId || 0, user?.id), 'objects'],
    queryFn: ({ signal }) => getCompanyObjects(String(companyId), false, signal),
    enabled: companyAllowed,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  return { companies, objects, companyAllowed, availableCompanies };
};
