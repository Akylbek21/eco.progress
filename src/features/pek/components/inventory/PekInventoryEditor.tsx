import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { useAuth } from '../../../../contexts/AuthContext';
import { pekInventoryApi, type InventoryKind, type InventoryRow } from '../../api/pekInventory';
import { inventoryDefinitions, inventoryPayload } from '../../model/pekInventoryFields';
import { pekKeys } from '../../api/pekQueryKeys';
import { mapPekError } from '../../utils/pekErrorMapper';
import PekQueryError from '../common/PekQueryError';

type Props = { kind: InventoryKind; parentId: number; programId: number; companyId?: number; canEdit: boolean };

export default function PekInventoryEditor({ kind, parentId, programId, companyId, canEdit }: Props) {
  const { user } = useAuth();
  const client = useQueryClient();
  const definition = inventoryDefinitions[kind];
  const [editing, setEditing] = useState<InventoryRow | null | undefined>();
  const [deleting, setDeleting] = useState<InventoryRow | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const rows = useQuery({
    queryKey: ['pek', `user:${user?.id}`, 'inventory', companyId, kind, parentId],
    queryFn: ({ signal }) => pekInventoryApi.list(parentId, kind, signal),
  });
  const wastes = useQuery({
    queryKey: ['pek', `user:${user?.id}`, 'inventory', companyId, 'waste-items', programId],
    queryFn: ({ signal }) => pekInventoryApi.list(programId, 'waste-items', signal),
    enabled: kind === 'waste-movements',
  });
  const open = (row: InventoryRow | null) => {
    setEditing(row);
    setValues(Object.fromEntries(definition.fields.map(({ key }) => [key, String(row?.[key] ?? '')])));
    setError(null);
    setConflict(false);
  };
  const refresh = () => client.invalidateQueries({ queryKey: pekKeys.all });
  const mutationError = async (failure: unknown) => {
    const mapped = mapPekError(failure);
    setError(mapped.message);
    if (mapped.status === 409 || mapped.status === 412) setConflict(true);
    await refresh();
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!canEdit) throw new Error('Редактирование недоступно.');
      const payload = inventoryPayload(kind, values);
      // POST is an upsert for movements; never overwrite an existing row without its version.
      const existing = editing ?? (kind === 'waste-movements'
        ? rows.data?.find(row => row.wasteItemId === payload.wasteItemId) : undefined);
      return pekInventoryApi.save(parentId, kind, payload, existing ?? undefined);
    },
    retry: false,
    onSuccess: async () => { setEditing(undefined); setError(null); await refresh(); },
    onError: mutationError,
  });
  const remove = useMutation({
    mutationFn: async (row: InventoryRow) => {
      if (!canEdit) throw new Error('Удаление недоступно.');
      await pekInventoryApi.remove(parentId, kind, row);
    },
    retry: false,
    onSuccess: async () => { setDeleting(null); setError(null); await refresh(); },
    onError: async failure => { setDeleting(null); await mutationError(failure); },
  });
  const busy = save.isPending || remove.isPending;
  const label = (row: InventoryRow) => String(row.name ?? row.wasteItemName ?? `Запись ${row.id}`);
  const availableWastes = wastes.data?.filter(waste => !rows.data?.some(row => row.wasteItemId === waste.id) || editing?.wasteItemId === waste.id) ?? [];

  if (rows.isPending) return <p role="status">Загрузка реестра…</p>;
  if (rows.isError) return <PekQueryError error={rows.error} resource={definition.title} retry={() => void rows.refetch()} />;

  return <section className="space-y-4 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-black">{definition.title}</h2>
      {canEdit && <Button variant="outlined" disabled={busy || (kind === 'waste-movements' && (wastes.isPending || wastes.isError || !availableWastes.length))} onClick={() => open(null)}>Добавить запись</Button>}
    </div>
    {error && <Alert severity="error">{error}</Alert>}
    {kind === 'waste-movements' && <>
      <p className="text-sm text-slate-600">Значения вводятся в единице измерения выбранного вида отхода. Остаток на конец сохраняется как введён, расхождение баланса показывается отдельно.</p>
      {wastes.isError && <PekQueryError error={wastes.error} resource="виды отходов" retry={() => void wastes.refetch()} />}
      {wastes.isSuccess && !wastes.data.length && <Alert severity="info">Сначала добавьте виды отходов в разделе «Реестры» программы ПЭК.</Alert>}
    </>}
    {!rows.data?.length && <p className="text-slate-500">Записи пока не добавлены.</p>}
    <div className="space-y-3">{rows.data?.map(row => <article key={row.id} className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">{label(row)}{row.code ? ` · ${row.code}` : ''}</h3>
        {canEdit && <div className="flex gap-2"><Button disabled={busy} onClick={() => open(row)}>Изменить</Button><Button color="error" disabled={busy} onClick={() => { setError(null); setDeleting(row); }}>Удалить</Button></div>}
      </div>
      {kind === 'waste-movements' && <p className="text-sm">Единица: {String(row.unit || 'не указана')}</p>}
      {row.reconciles === false && <Alert severity="warning">Баланс не сходится. Расчётный остаток: {String(row.impliedClosingBalance ?? '—')}; введённый: {String(row.closingBalance ?? '—')}.</Alert>}
      <details className="mt-2"><summary className="cursor-pointer text-sm font-semibold">Сведения</summary><dl className="mt-3 grid gap-3 sm:grid-cols-2">{definition.fields.filter(field => field.type !== 'waste').map(field => <div key={field.key}><dt className="text-xs text-slate-500">{field.label}</dt><dd className="break-words text-sm">{String(row[field.key] ?? '—')}</dd></div>)}</dl></details>
    </article>)}</div>
    <Dialog open={editing !== undefined} onClose={() => { if (!busy) setEditing(undefined); }} fullWidth maxWidth="md">
      <DialogTitle>{editing ? 'Изменить запись' : 'Добавить запись'} — {definition.title}</DialogTitle>
      <form onSubmit={event => { event.preventDefault(); if (!busy && !conflict && canEdit) save.mutate(); }}>
        <DialogContent>
          {error && <Alert severity="error" className="mb-4">{error}</Alert>}
          {conflict && <Alert severity="warning" className="mb-4">Данные обновлены. Закройте форму и откройте запись заново, чтобы проверить актуальные значения перед сохранением.</Alert>}
          {!canEdit && <Alert severity="info">Редактирование больше недоступно.</Alert>}
          <div className="grid gap-4 pt-2 sm:grid-cols-2">{definition.fields.map(field => <TextField
            key={field.key} label={field.label} required={field.required} value={values[field.key] ?? ''}
            disabled={busy || conflict || !canEdit || (field.type === 'waste' && Boolean(editing))}
            select={field.type === 'waste'} fullWidth
            onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))}
            helperText={field.type === 'waste' ? `Единица: ${String(wastes.data?.find(waste => waste.id === Number(values.wasteItemId))?.limitUnit || 'не указана')}` : undefined}
            slotProps={{ htmlInput: { inputMode: field.type === 'decimal' ? 'decimal' : field.type === 'integer' ? 'numeric' : 'text' } }}
          >{field.type === 'waste' ? availableWastes.map(waste => <MenuItem key={waste.id} value={String(waste.id)}>{String(waste.name)}{waste.code ? ` · ${waste.code}` : ''}</MenuItem>) : undefined}</TextField>)}</div>
        </DialogContent>
        <DialogActions><Button disabled={busy} onClick={() => setEditing(undefined)}>Отмена</Button><Button type="submit" variant="contained" disabled={busy || conflict || !canEdit || (kind === 'waste-movements' && !wastes.isSuccess)}>{save.isPending ? 'Сохранение…' : 'Сохранить'}</Button></DialogActions>
      </form>
    </Dialog>
    <Dialog open={Boolean(deleting)} onClose={() => { if (!busy) setDeleting(null); }}>
      <DialogTitle>Удалить запись?</DialogTitle><DialogContent>{deleting && label(deleting)}</DialogContent>
      <DialogActions><Button disabled={busy} onClick={() => setDeleting(null)}>Отмена</Button><Button color="error" disabled={busy || !canEdit} onClick={() => deleting && remove.mutate(deleting)}>Удалить</Button></DialogActions>
    </Dialog>
  </section>;
}
