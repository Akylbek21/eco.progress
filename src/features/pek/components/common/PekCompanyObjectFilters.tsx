import { useQuery } from '@tanstack/react-query';
import { getCompanies, getCompanyObjects } from '../../../../services/companyService';
import { retryPekQuery } from '../../utils/pekQueryPolicy';

type Props = {
  companyId?: number;
  objectId?: number;
  onCompanyChange: (value: string) => void;
  onObjectChange: (value: string) => void;
};

const PekCompanyObjectFilters = ({ companyId, objectId, onCompanyChange, onObjectChange }: Props) => {
  const companies = useQuery({
    queryKey: ['pek', 'filters', 'companies'],
    queryFn: ({ signal }) => getCompanies({ page: 0, size: 100, status: 'ACTIVE' }, signal),
    retry: retryPekQuery,
    staleTime: 60_000,
  });
  const objects = useQuery({
    queryKey: ['pek', 'filters', 'objects', companyId],
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

  return <>
    <label className="text-xs font-bold text-slate-600">Компания
      <select
        value={companyId || ''}
        disabled={companies.isLoading || companies.isError}
        onChange={(event) => {
          onCompanyChange(event.target.value);
          onObjectChange('');
        }}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm disabled:bg-slate-100"
      >
        <option value="">{companies.isLoading ? 'Загрузка…' : 'Все компании'}</option>
        {companies.data?.items.map((item) => <option key={item.id} value={item.id}>{item.name} · БИН {item.bin}</option>)}
      </select>
      {companies.isError && <button type="button" onClick={() => void companies.refetch()} className="mt-1 block text-xs text-rose-700 underline">Повторить загрузку</button>}
    </label>
    <label className="text-xs font-bold text-slate-600">Объект
      <select
        value={objectId || ''}
        disabled={!companyId || objects.isLoading || objects.isError}
        onChange={(event) => onObjectChange(event.target.value)}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm disabled:bg-slate-100"
      >
        <option value="">{objects.isLoading ? 'Загрузка…' : 'Все объекты'}</option>
        {realObjects.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.address}</option>)}
      </select>
      {objects.isError && <button type="button" onClick={() => void objects.refetch()} className="mt-1 block text-xs text-rose-700 underline">Повторить загрузку</button>}
    </label>
  </>;
};

export default PekCompanyObjectFilters;
