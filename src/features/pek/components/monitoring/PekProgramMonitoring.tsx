import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import type { PekMonitoringDirection, PekMonitoringMutationRequest, PekMonitoringType, PekPeriodicity, PekProgram } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';
import PekQueryError from '../common/PekQueryError';

type FormState = {
  monitoringType: PekMonitoringType | '';
  name: string;
  methodology: string;
  laboratoryId: string;
  frequencyType: PekPeriodicity | '';
  plannedCount: string;
  controlItemIds: string;
  protocolTypes: string;
  active: boolean;
};

const monitoringTypes: PekMonitoringType[] = ['AMBIENT_AIR', 'EMISSION_SOURCE', 'SURFACE_WATER', 'GROUNDWATER', 'WASTEWATER', 'SOIL', 'WASTE', 'PHYSICAL_FACTOR'];
const frequencyTypes: PekPeriodicity[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'PER_EVENT'];
const emptyForm: FormState = { monitoringType: '', name: '', methodology: '', laboratoryId: '', frequencyType: '', plannedCount: '0', controlItemIds: '', protocolTypes: '', active: true };
const csv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean);
const numberCsv = (value: string) => csv(value).map(Number).filter(Number.isFinite);

const formFromItem = (item: PekMonitoringDirection): FormState => ({
  monitoringType: item.monitoringType,
  name: item.name,
  methodology: item.methodology || '',
  laboratoryId: item.laboratoryId == null ? '' : String(item.laboratoryId),
  frequencyType: item.frequencyType,
  plannedCount: String(item.plannedCount),
  controlItemIds: item.controlItemIds.join(', '),
  protocolTypes: item.protocolTypes.join(', '),
  active: item.active,
});

const requestFromForm = (form: FormState): PekMonitoringMutationRequest => ({
  monitoringType: form.monitoringType as PekMonitoringType,
  name: form.name.trim(),
  methodology: form.methodology.trim() || null,
  laboratoryId: form.laboratoryId ? Number(form.laboratoryId) : null,
  frequencyType: form.frequencyType as PekPeriodicity,
  plannedCount: Number(form.plannedCount),
  controlItemIds: numberCsv(form.controlItemIds),
  protocolTypes: csv(form.protocolTypes),
  active: form.active,
});

const PekProgramMonitoring = ({ program }: { program: PekProgram }) => {
  const { user } = useAuth();
  const queryKey = pekKeys.programMonitoring(program.id, program.company?.id, user?.id);
  const monitoring = useQuery({ queryKey, queryFn: ({ signal }) => pekApi.getProgramMonitoring(program.id, signal) });
  const [editing, setEditing] = useState<PekMonitoringDirection | 'new' | null>(null);
  const [deleting, setDeleting] = useState<PekMonitoringDirection | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const save = useMutation({
    mutationFn: async () => {
      const body = requestFromForm(form);
      if (editing === 'new') await pekApi.createProgramMonitoring(program.id, body);
      else if (editing) await pekApi.updateProgramMonitoring(program.id, editing.id, body, editing.version);
    },
    onSuccess: async () => { setEditing(null); await monitoring.refetch(); },
  });
  const remove = useMutation({
    mutationFn: async () => { if (deleting) await pekApi.deleteProgramMonitoring(program.id, deleting.id, deleting.version); },
    onSuccess: async () => { setDeleting(null); await monitoring.refetch(); },
  });

  if (monitoring.isLoading) return <p className="text-sm text-slate-500">Загрузка направлений мониторинга…</p>;
  if (monitoring.isError || !monitoring.data) return <PekQueryError error={monitoring.error} resource="направления мониторинга" retry={() => void monitoring.refetch()} />;

  const mutationError = save.error || remove.error;
  const canCreate = monitoring.data.availableActions.create === true;
  const openCreate = () => { setForm(emptyForm); setEditing('new'); };
  const openEdit = (item: PekMonitoringDirection) => { setForm(formFromItem(item)); setEditing(item); };

  return <section className="space-y-4 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-black">Направления мониторинга</h2><p className="text-sm text-slate-500">Настройки производственного экологического контроля.</p></div>
      {canCreate && <Button variant="contained" onClick={openCreate}>Добавить направление</Button>}
    </div>
    {mutationError && <Alert severity="error">{mapPekError(mutationError).message}</Alert>}
    {!monitoring.data.items.length ? <Alert severity="info">Направления мониторинга пока не добавлены.</Alert> : <div className="grid gap-3">
      {monitoring.data.items.map((item) => <article key={item.id} className="rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-black">{item.name}</h3><p className="text-sm text-slate-500">{item.monitoringType} · {item.frequencyType} · план: {item.plannedCount}</p></div>
          <div className="flex gap-2">
            {item.availableActions.edit === true && <Button size="small" variant="outlined" onClick={() => openEdit(item)}>Изменить</Button>}
            {item.availableActions.delete === true && <Button size="small" color="error" onClick={() => setDeleting(item)}>Удалить</Button>}
          </div>
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Методика</dt><dd>{item.methodology || '—'}</dd></div>
          <div><dt className="text-slate-500">Лаборатория</dt><dd>{item.laboratoryId ?? '—'}</dd></div>
          <div><dt className="text-slate-500">Объекты контроля</dt><dd>{item.controlItemIds.join(', ') || '—'}</dd></div>
          <div><dt className="text-slate-500">Типы протоколов</dt><dd>{item.protocolTypes.join(', ') || '—'}</dd></div>
        </dl>
      </article>)}
    </div>}

    <Dialog open={Boolean(editing)} onClose={() => !save.isPending && setEditing(null)} fullWidth maxWidth="md">
      <DialogTitle>{editing === 'new' ? 'Добавить направление' : 'Изменить направление'}</DialogTitle>
      <DialogContent><div className="mt-2 grid gap-4 sm:grid-cols-2">
        <TextField select label="Тип мониторинга *" value={form.monitoringType} onChange={(event) => setForm((value) => ({ ...value, monitoringType: event.target.value as PekMonitoringType }))}>{monitoringTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</TextField>
        <TextField label="Название *" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} />
        <TextField label="Методика" value={form.methodology} onChange={(event) => setForm((value) => ({ ...value, methodology: event.target.value }))} />
        <TextField label="ID лаборатории" type="number" value={form.laboratoryId} onChange={(event) => setForm((value) => ({ ...value, laboratoryId: event.target.value }))} />
        <TextField select label="Периодичность *" value={form.frequencyType} onChange={(event) => setForm((value) => ({ ...value, frequencyType: event.target.value as PekPeriodicity }))}>{frequencyTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</TextField>
        <TextField label="Плановое количество *" type="number" value={form.plannedCount} onChange={(event) => setForm((value) => ({ ...value, plannedCount: event.target.value }))} />
        <TextField label="ID объектов контроля через запятую" value={form.controlItemIds} onChange={(event) => setForm((value) => ({ ...value, controlItemIds: event.target.value }))} />
        <TextField label="Типы протоколов через запятую" value={form.protocolTypes} onChange={(event) => setForm((value) => ({ ...value, protocolTypes: event.target.value }))} />
        <FormControlLabel control={<Checkbox checked={form.active} onChange={(event) => setForm((value) => ({ ...value, active: event.target.checked }))} />} label="Активно" />
      </div></DialogContent>
      <DialogActions><Button onClick={() => setEditing(null)}>Отмена</Button><Button variant="contained" disabled={save.isPending || !form.monitoringType || !form.name.trim() || !form.frequencyType} onClick={() => save.mutate()}>Сохранить</Button></DialogActions>
    </Dialog>
    <Dialog open={Boolean(deleting)} onClose={() => !remove.isPending && setDeleting(null)}><DialogTitle>Удалить направление?</DialogTitle><DialogActions><Button onClick={() => setDeleting(null)}>Отмена</Button><Button color="error" disabled={remove.isPending} onClick={() => remove.mutate()}>Удалить</Button></DialogActions></Dialog>
  </section>;
};

export default PekProgramMonitoring;
