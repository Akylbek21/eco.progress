import { useQuery } from '@tanstack/react-query';
import { Alert, MenuItem, TextField } from '@mui/material';
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

export default function PekControlSourceSelect({ programId, value, onChange }: {
  programId?: number; value: PekControlItem; onChange: (patch: Partial<PekControlItem>) => void;
}) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['pek', `user:${user?.id}`, 'control-source-options', programId],
    enabled: Boolean(programId),
    queryFn: async ({ signal }) => {
      const [program, emissions, discharges, wastes] = await Promise.all([
        pekApi.getProgram(programId!, signal),
        pekInventoryApi.list(programId!, 'emission-sources', signal),
        pekInventoryApi.list(programId!, 'discharge-sources', signal),
        pekInventoryApi.list(programId!, 'waste-items', signal),
      ]);
      const points = (await Promise.all((program.monitoring?.items || []).map(direction =>
        pekApi.getMonitoringPoints(programId!, direction.id, signal)))).flat();
      return { monitoringPointId: points, emissionSourceId: emissions, waterOutletId: discharges, wasteSourceId: wastes };
    },
  });
  if (!programId) return <Alert severity="info">Сохраните черновик программы, добавьте источники в «Реестрах» и точки в «Производственном мониторинге», затем выберите их при редактировании позиции.</Alert>;
  if (query.isError) return <PekQueryError error={query.error} resource="Источники программы" retry={() => void query.refetch()} />;
  return <div className="grid gap-3 md:col-span-3 sm:grid-cols-2">{sources.map(([key, label]) => {
    const options = query.data?.[key] || [];
    const missing = value[key] != null && !options.some(option => option.id === value[key]);
    return <TextField key={key} select label={label} value={value[key] ?? ''} disabled={query.isPending}
      helperText={query.isPending ? 'Загрузка…' : missing ? 'Связанный источник недоступен. Выберите актуальный.' : !options.length ? 'Добавьте записи в соответствующем разделе программы.' : 'Источники текущей программы'}
      error={missing && !query.isPending} onChange={event => onChange({ [key]: event.target.value ? Number(event.target.value) : null })}>
      <MenuItem value="">Не выбран</MenuItem>
      {missing && <MenuItem value={value[key]!} disabled>Источник недоступен</MenuItem>}
      {options.map(option => <MenuItem key={option.id} value={option.id}>{String(option.name)}</MenuItem>)}
    </TextField>;
  })}</div>;
}
