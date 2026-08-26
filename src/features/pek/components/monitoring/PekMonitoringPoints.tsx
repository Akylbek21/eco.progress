import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useState } from 'react';
import type { PekMonitoringPoint } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';

type FormState = { name: string; latitude: string; longitude: string; description: string };
const emptyForm: FormState = { name: '', latitude: '', longitude: '', description: '' };
const coordinatePattern = /^-?\d+(?:\.\d+)?$/;

const PekMonitoringPoints = ({ programId, monitoringId, editable }: { programId: number; monitoringId: number; editable: boolean }) => {
  const client = useQueryClient();
  const queryKey = pekKeys.programSection(programId, 'monitoring-points', monitoringId);
  const points = useQuery({ queryKey, queryFn: ({ signal }) => pekApi.getMonitoringPoints(programId, monitoringId, signal) });
  const [editing, setEditing] = useState<PekMonitoringPoint | 'new' | null>(null);
  const [deleting, setDeleting] = useState<PekMonitoringPoint | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey }),
      client.invalidateQueries({ predicate: ({ queryKey: key }) => key[0] === 'pek' && key[1] === 'program' && key[3] === programId }),
    ]);
  };
  const save = useMutation({
    mutationFn: () => editing === 'new'
      ? pekApi.createMonitoringPoint(programId, monitoringId, { name: form.name.trim(), latitude: form.latitude ? Number(form.latitude) : null, longitude: form.longitude ? Number(form.longitude) : null, description: form.description.trim() || null })
      : pekApi.updateMonitoringPoint(programId, editing!.id, editing!.version, { name: form.name.trim(), latitude: form.latitude ? Number(form.latitude) : null, longitude: form.longitude ? Number(form.longitude) : null, description: form.description.trim() || null }),
    onSuccess: async () => { setEditing(null); await refresh(); },
    retry: false,
  });
  const remove = useMutation({
    mutationFn: () => pekApi.deleteMonitoringPoint(programId, deleting!.id, deleting!.version),
    onSuccess: async () => { setDeleting(null); await refresh(); },
    retry: false,
  });
  const openCreate = () => { setForm(emptyForm); setEditing('new'); };
  const openEdit = (point: PekMonitoringPoint) => {
    const [legacyLatitude = '', legacyLongitude = ''] = (point.coordinates || '').split(',').map((value) => value.trim());
    setForm({ name: point.name, latitude: point.latitude == null ? legacyLatitude : String(point.latitude), longitude: point.longitude == null ? legacyLongitude : String(point.longitude), description: point.description || '' });
    setEditing(point);
  };
  const latitudeValid = !form.latitude || (coordinatePattern.test(form.latitude) && Number(form.latitude) >= -90 && Number(form.latitude) <= 90);
  const longitudeValid = !form.longitude || (coordinatePattern.test(form.longitude) && Number(form.longitude) >= -180 && Number(form.longitude) <= 180);

  return <div className="mt-4 rounded-xl bg-slate-50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h4 className="font-bold">Точки мониторинга</h4><p className="text-xs text-slate-500">Координаты задаются отдельно. Пример пары: 52.905785, 69.153399.</p></div>
      {editable && <Button size="small" variant="outlined" onClick={openCreate}>+ Добавить точку</Button>}
    </div>
    {points.isLoading && <p className="mt-3 text-sm text-slate-500">Загрузка точек…</p>}
    {points.isError && <Alert className="mt-3" severity="error">{mapPekError(points.error).message}</Alert>}
    {points.data && !points.data.length && <p className="mt-3 text-sm text-slate-500">Точки пока не добавлены.</p>}
    <div className="mt-3 grid gap-2">
      {points.data?.map((point) => <div key={point.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-white p-3">
        <div><p className="font-semibold">{point.name}</p><p className="text-sm text-slate-600">{point.latitude != null && point.longitude != null ? `${point.latitude}, ${point.longitude}` : point.coordinates || 'Координаты не указаны'}</p>{point.description && <p className="mt-1 text-xs text-slate-500">{point.description}</p>}</div>
        {editable && <div className="flex gap-2"><Button size="small" onClick={() => openEdit(point)}>Изменить</Button><Button size="small" color="error" onClick={() => setDeleting(point)}>Удалить</Button></div>}
      </div>)}
    </div>
    <Dialog open={Boolean(editing)} onClose={() => !save.isPending && setEditing(null)} fullWidth maxWidth="sm">
      <DialogTitle>{editing === 'new' ? 'Добавить точку мониторинга' : 'Изменить точку мониторинга'}</DialogTitle>
      <DialogContent><div className="mt-2 grid gap-4">
        <TextField label="Название *" value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} />
        <TextField label="Описание" multiline minRows={3} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} />
        <TextField label="Широта" value={form.latitude} error={!latitudeValid} helperText={latitudeValid ? 'Например: 52.905785' : 'Значение от −90 до 90'} onChange={(event) => setForm((value) => ({ ...value, latitude: event.target.value }))} />
        <TextField label="Долгота" value={form.longitude} error={!longitudeValid} helperText={longitudeValid ? 'Например: 69.153399' : 'Значение от −180 до 180'} onChange={(event) => setForm((value) => ({ ...value, longitude: event.target.value }))} />
        {save.isError && <Alert severity="error">{mapPekError(save.error).message}</Alert>}
      </div></DialogContent>
      <DialogActions><Button onClick={() => setEditing(null)}>Отмена</Button><Button variant="contained" disabled={save.isPending || !form.name.trim() || !latitudeValid || !longitudeValid} onClick={() => save.mutate()}>Сохранить</Button></DialogActions>
    </Dialog>
    <Dialog open={Boolean(deleting)} onClose={() => !remove.isPending && setDeleting(null)}><DialogTitle>Удалить точку «{deleting?.name}»?</DialogTitle><DialogActions><Button onClick={() => setDeleting(null)}>Отмена</Button><Button color="error" disabled={remove.isPending} onClick={() => remove.mutate()}>Удалить</Button></DialogActions></Dialog>
  </div>;
};

export default PekMonitoringPoints;
