import { useQuery } from '@tanstack/react-query';
import { Alert, Autocomplete, TextField } from '@mui/material';
import { useAuth } from '../../../../contexts/AuthContext';
import type { PekControlItem } from '../../api/pekContracts';
import { pekInventoryApi } from '../../api/pekInventory';
import { pekApi } from '../../api/pekService';
import PekQueryError from '../common/PekQueryError';

const sources = [
  ['monitoringPointId', 'Точка мониторинга'],
  ['emissionSourceId', 'Источник выбросов'],
  ['waterOutletId', 'Выпуск сточных вод'],
  ['wasteSourceId', 'Вид отхода'],
] as const;

const useControlSourceOptions = (programId?: number) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['pek', `user:${user?.id}`, 'control-source-options', programId],
    enabled: Boolean(programId),
    queryFn: async ({ signal }) => {
      const [monitoring, emissions, discharges, wastes] = await Promise.all([
        pekApi.getProgramMonitoring(programId!, signal),
        pekInventoryApi.list(programId!, 'emission-sources', signal),
        pekInventoryApi.list(programId!, 'discharge-sources', signal),
        pekInventoryApi.list(programId!, 'waste-items', signal),
      ]);
      const points = (await Promise.all((monitoring.items || []).map(direction =>
        pekApi.getMonitoringPoints(programId!, direction.id, signal)))).flat();
      return { monitoringPointId: points, emissionSourceId: emissions, waterOutletId: discharges, wasteSourceId: wastes };
    },
  });
};

export const PekControlSourceSummary = ({ programId, value }: { programId?: number; value: PekControlItem }) => {
  const query = useControlSourceOptions(programId);
  if (query.isLoading) return <span>Загрузка связей…</span>;
  const selected = sources.flatMap(([key, label]) => {
    const selectedId = value[key];
    if (!selectedId) return [];
    const option = query.data?.[key]?.find((item) => item.id === selectedId);
    return [`${label}: ${option?.name || `№ ${selectedId}`}`];
  });
  if (value.appliesToAllPoints) return <span className="rounded bg-slate-100 px-1.5 py-0.5">Все точки направления</span>;
  return <>{selected.length ? selected.map((label) => <span key={label} className="rounded bg-slate-100 px-1.5 py-0.5">{label}</span>) : <span className="text-amber-700">Точка или источник не выбраны</span>}</>;
};

export default function PekControlSourceSelect({ programId, value, onChange }: {
  programId?: number; value: PekControlItem; onChange: (patch: Partial<PekControlItem>) => void;
}) {
  const query = useControlSourceOptions(programId);
  if (!programId) return <Alert severity="info">Сохраните черновик программы, добавьте источники в «Реестрах» и точки в «Производственном мониторинге», затем выберите их при редактировании позиции.</Alert>;
  if (query.isError) return <PekQueryError error={query.error} resource="Источники программы" retry={() => void query.refetch()} />;
  const clearLocation = Object.fromEntries(sources.map(([key]) => [key, null])) as Partial<PekControlItem>;
  return <div className="grid gap-3 md:col-span-3 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-xl border p-3 sm:col-span-2"><input type="checkbox" checked={value.appliesToAllPoints === true} onChange={(event) => onChange({ ...clearLocation, appliesToAllPoints: event.target.checked })} />Применять ко всем точкам направления</label>{sources.map(([key, label]) => {
    const options = (query.data?.[key] || []).map(option => ({ id: Number(option.id), name: String(option.name) }));
    const missing = value[key] != null && !options.some(option => option.id === value[key]);
    const selected = options.find(option => option.id === value[key]) ?? null;
    return <Autocomplete
      key={key}
      options={options}
      value={selected}
      disabled={query.isPending || value.appliesToAllPoints === true}
      getOptionLabel={option => option.name}
      isOptionEqualToValue={(option, selectedOption) => option.id === selectedOption.id}
      noOptionsText="Совпадений нет"
      onChange={(_, option) => onChange({ ...clearLocation, appliesToAllPoints: false, [key]: option?.id ?? null })}
      renderInput={params => <TextField
        {...params}
        label={label}
        placeholder="Введите или выберите"
        helperText={query.isPending ? 'Загрузка…' : missing ? 'Связанная запись недоступна. Выберите актуальную.' : !options.length ? 'Сначала добавьте запись в соответствующем разделе программы.' : 'Начните вводить название или выберите из списка'}
        error={missing && !query.isPending}
      />}
    />;
  })}</div>;
}
