import { useEffect } from 'react';
import { usePekScope } from '../../hooks/usePekScope';
import { mapPekError } from '../../utils/pekErrorMapper';

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
  const scope = usePekScope(companyId);
  const objects = scope.objects;
  const realObjects = (objects.data || []).filter((item) =>
    item.status !== 'ARCHIVED'
    && item.persisted !== false
    && item.isVirtual !== true
    && Number(item.id) > 0);

  useEffect(() => {
    const available = scope.companies;
    if (!companyId && available.length === 1) onCompanyChange(String(available[0].id));
  }, [scope.companies, companyId, onCompanyChange]);

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
      <input
        type="number"
        min="1"
        list="pek-company-options"
        aria-label="Компания"
        value={companyId || ''}
        onChange={(event) => {
          onCompanyChange(event.target.value);
          onObjectChange('');
        }}
        placeholder={scope.scopedPrograms.isLoading ? 'Загрузка PEK scope…' : 'Выберите или укажите ID компании'}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm disabled:bg-slate-100"
      />
      <datalist id="pek-company-options">{scope.companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</datalist>
      {companyId && scope.companyAccess.isFetching && <span className="mt-1 block text-xs text-slate-500">Проверяем PEK-доступ…</span>}
      {companyId && scope.companyAccess.isError && <span className="mt-1 block text-xs text-rose-700">{mapPekError(scope.companyAccess.error).message}</span>}
      {scope.scopedPrograms.isError && <button type="button" onClick={() => void scope.scopedPrograms.refetch()} className="mt-1 text-xs text-rose-700 underline">Повторить загрузку PEK scope</button>}
    </label>
    <label className="text-xs font-bold text-slate-600">
      Объект{required ? ' *' : ''}
      <select
        aria-label="Объект"
        value={objectId || ''}
        disabled={!scope.companyAllowed || objects.isLoading || objects.isError}
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
