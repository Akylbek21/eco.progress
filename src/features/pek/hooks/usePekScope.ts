import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { getCompanyObjects } from '../../../services/companyService';
import type { PekNamedRef } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const uniqueRefs = (values: Array<PekNamedRef | null | undefined>) => {
  const map = new Map<number, PekNamedRef>();
  values.forEach((value) => {
    if (value?.id && !map.has(Number(value.id))) map.set(Number(value.id), { ...value, id: Number(value.id) });
  });
  return [...map.values()].sort((left, right) => left.name.localeCompare(right.name, 'ru'));
};

/**
 * PEK scope is discovered only through tenant-scoped PEK responses. The regular
 * company list is deliberately not used as an authorization source. A manually
 * entered company is validated by PEK dashboard before its objects are loaded.
 */
export const usePekScope = (companyId?: number) => {
  const { user } = useAuth();
  const scopedPrograms = useQuery({
    queryKey: pekKeys.scope(user?.id),
    queryFn: ({ signal }) => pekApi.getPrograms({ page: 0, size: 100, sort: 'number,asc' }, signal),
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const discoveredCompanies = useMemo(
    () => uniqueRefs((scopedPrograms.data?.content || []).map((program) => program.company)),
    [scopedPrograms.data?.content],
  );
  const discovered = Boolean(companyId && discoveredCompanies.some((company) => company.id === companyId));
  const companyAccess = useQuery({
    queryKey: pekKeys.scopeCompany(companyId || 0, user?.id),
    queryFn: ({ signal }) => pekApi.getDashboard({ companyId }, signal),
    enabled: Boolean(companyId && !discovered),
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const companyAllowed = Boolean(companyId && (discovered || companyAccess.isSuccess));
  const objects = useQuery({
    queryKey: [...pekKeys.scopeCompany(companyId || 0, user?.id), 'objects'],
    queryFn: ({ signal }) => getCompanyObjects(String(companyId), false, signal),
    enabled: companyAllowed,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const companies = useMemo(() => {
    if (!companyId || discoveredCompanies.some((company) => company.id === companyId) || !companyAccess.isSuccess) return discoveredCompanies;
    return [...discoveredCompanies, { id: companyId, name: `Компания №${companyId}` }];
  }, [companyAccess.isSuccess, companyId, discoveredCompanies]);
  return { companies, objects, companyAccess, companyAllowed, scopedPrograms };
};
