import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getCompanies, getCompanyObjects } from '../../../../services/companyService';
import { useAuth } from '../../../../contexts/AuthContext';
import { retryPekQuery } from '../../utils/pekQueryPolicy';

type Props = {
  companyId?: number;
  objectId?: number;
  onCompanyChange: (value: string) => void;
  onObjectChange: (value: string) => void;
  required?: boolean;
};

const PekCompanyObjectFilters = ({
  companyId,
  objectId,
  onCompanyChange,
  onObjectChange,
  required,
}: Props) => {
  const { user } = useAuth();
  const companies = useQuery({
    queryKey: ['pek', `user:${user?.id ?? 'anonymous'}`, 'filters', 'companies'],
    queryFn: ({ signal }) => getCompanies({ page: 0, size: 100, status: 'ACTIVE' }, signal),
    retry: retryPekQuery,
    staleTime: 60_000,
  });
  const objects = useQuery({
    queryKey: ['pek', `user:${user?.id ?? 'anonymous'}`, 'filters', 'objects', companyId],
    queryFn: ({ signal }) => getCompanyObjects(String(companyId), false, signal),
    enabled: Boolean(companyId),
    retry: retryPekQuery,
    staleTime: 60_000,
  });
  const realObjects = (objects.data || []).filter((item) =>
    item.status !== 'ARCHIVED'
    && item.persisted !== false
    && item.isVirtual !== true
    && Number(item.id) > 0);

  useEffect(() => {
    if (!companies.data) return;
    const available = companies.data.items;
    if (companyId && !available.some((item) => Number(item.id) === companyId)) {
      onCompanyChange('');
      onObjectChange('');
      return;
    }
    if (!companyId && available.length === 1) onCompanyChange(String(available[0].id));
  }, [companies.data, companyId, onCompanyChange, onObjectChange]);

  useEffect(() => {
    if (!companyId || !objects.data) return;
    if (objectId && !realObjects.some((item) => Number(item.id) === objectId)) {
      onObjectChange('');
      return;
    }
    if (!objectId && realObjects.length === 1) onObjectChange(String(realObjects[0].id));
  }, [companyId, objectId, objects.data, onObjectChange, realObjects]);

  return <>
    <label className="text-xs font-bold text-slate-600">
      Компания{required ? ' *' : ''}
      <select
        aria-label="Компания"
        value={companyId || ''}
        disabled={companies.isLoading || companies.isError}
        onChange={(event) => {
          onCompanyChange(event.target.value);
          onObjectChange('');
        }}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm disabled:bg-slate-100"
      >
        <option value="">{companies.isLoading ? 'Загрузка…' : 'Выберите компанию'}</option>
        {companies.data?.items.map((item) => (
          <option key={item.id} value={item.id}>{item.name} · БИН {item.bin}</option>
        ))}
      </select>
      {companies.isError && (
        <button type="button" onClick={() => void companies.refetch()} className="mt-1 text-xs text-rose-700 underline">
          Повторить загрузку
        </button>
      )}
    </label>
    <label className="text-xs font-bold text-slate-600">
      Объект{required ? ' *' : ''}
      <select
        aria-label="Объект"
        value={objectId || ''}
        disabled={!companyId || objects.isLoading || objects.isError}
        onChange={(event) => onObjectChange(event.target.value)}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm disabled:bg-slate-100"
      >
        <option value="">{objects.isLoading ? 'Загрузка…' : 'Выберите объект'}</option>
        {realObjects.map((item) => (
          <option key={item.id} value={item.id}>{item.name}{item.address ? ` · ${item.address}` : ''}</option>
        ))}
      </select>
      {objects.isError && (
        <button type="button" onClick={() => void objects.refetch()} className="mt-1 text-xs text-rose-700 underline">
          Повторить загрузку
        </button>
      )}
    </label>
  </>;
};

export default PekCompanyObjectFilters;
