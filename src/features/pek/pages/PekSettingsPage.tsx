import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../hooks/useToast';
import type { PekSettings } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekService } from '../api/pekService';
import { PekLoading, PekPageHeader, PekState } from '../components/common/PekUi';
import { mapPekError } from '../utils/pekErrorMapper';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const PekSettingsPage = () => {
  const client = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<PekSettings | null>(null);
  const query = useQuery({
    queryKey: pekKeys.settings(),
    queryFn: ({ signal }) => pekService.getSettings(signal),
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  useEffect(() => { if (query.data) setForm(query.data); }, [query.data]);
  const mutation = useMutation({
    mutationFn: (value: PekSettings) => pekService.updateSettings(value),
    retry: false,
    onSuccess: (saved) => {
      client.setQueryData(pekKeys.settings(), saved);
      setForm(saved);
      toast.success('Настройки ПЭК сохранены');
    },
    onError: (failure) => toast.error(mapPekError(failure).message),
  });

  if (query.isLoading) return <PekLoading />;
  if (query.isError || !form) return <PekState title="Не удалось загрузить настройки ПЭК" retry={() => void query.refetch()} />;
  const updateNumber = (key: 'collectionPollingIntervalMs' | 'autosaveDebounceMs' | 'notificationDaysBeforeDeadline', raw: string) =>
    setForm((current) => current ? { ...current, [key]: Math.max(0, Number(raw) || 0) } : current);

  return <div className="space-y-5">
    <PekPageHeader title="Настройки ПЭК" description="Системные значения загружаются и сохраняются через backend." />
    <section className="grid gap-4 rounded-2xl border bg-white p-5 md:grid-cols-2">
      <label className="text-sm font-bold">Интервал обновления сбора, мс
        <input type="number" min={1000} value={form.collectionPollingIntervalMs} onChange={(event) => updateNumber('collectionPollingIntervalMs', event.target.value)} className="mt-1 w-full rounded-xl border p-3" />
      </label>
      <label className="text-sm font-bold">Задержка автосохранения, мс
        <input type="number" min={300} value={form.autosaveDebounceMs} onChange={(event) => updateNumber('autosaveDebounceMs', event.target.value)} className="mt-1 w-full rounded-xl border p-3" />
      </label>
      <label className="text-sm font-bold">Период отчёта по умолчанию
        <select value={form.defaultReportPeriodType || ''} onChange={(event) => setForm({ ...form, defaultReportPeriodType: event.target.value as PekSettings['defaultReportPeriodType'] })} className="mt-1 w-full rounded-xl border p-3">
          <option value="">Определяет backend</option>
          <option value="QUARTER">Квартал</option>
          <option value="YEAR">Год</option>
        </select>
      </label>
      <label className="text-sm font-bold">Предупреждать о сроке за дней
        <input type="number" min={0} value={form.notificationDaysBeforeDeadline || 0} onChange={(event) => updateNumber('notificationDaysBeforeDeadline', event.target.value)} className="mt-1 w-full rounded-xl border p-3" />
      </label>
    </section>
    <div className="sticky bottom-4 flex justify-end rounded-2xl border bg-white/95 p-3 shadow-lg backdrop-blur">
      <Button disabled={mutation.isPending} aria-busy={mutation.isPending} onClick={() => mutation.mutate(form)}>
        {mutation.isPending ? 'Сохранение…' : 'Сохранить настройки'}
      </Button>
    </div>
  </div>;
};

export default PekSettingsPage;
