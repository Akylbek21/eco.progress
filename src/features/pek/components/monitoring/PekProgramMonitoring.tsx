import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../../contexts/AuthContext';
import type { PekMonitoringDirection, PekMonitoringMutationRequest, PekMonitoringType, PekProgram } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';
import PekQueryError from '../common/PekQueryError';

const sections = ['Точки контроля', 'Показатели', 'Нормативы', 'Периодичность', 'План', 'Факт', 'Протоколы', 'Превышения'] as const;
type FormState = {
  monitoringType: PekMonitoringType | '';
  controlPoints: string;
  indicators: string;
  normatives: string;
  units: string;
  periodicity: string;
  plannedResearchCount: string;
  methodology: string;
  laboratoryId: string;
  protocolIds: number[];
};
const emptyForm: FormState = { monitoringType: '', controlPoints: '', indicators: '', normatives: '', units: '', periodicity: '', plannedResearchCount: '0', methodology: '', laboratoryId: '', protocolIds: [] };
const lines = (value: string, key: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).map((item) => ({ [key]: item }));
const rowLabel = (row: Record<string, unknown>) => String(row.name ?? row.label ?? row.code ?? row.indicatorName ?? row.normativeValue ?? row.value ?? 'Без названия');
const formFromDirection = (item: PekMonitoringDirection): FormState => ({
  monitoringType: item.monitoringType,
  controlPoints: item.controlPoints.map(rowLabel).join('\n'),
  indicators: item.indicators.map(rowLabel).join('\n'),
  normatives: item.normatives.map(rowLabel).join('\n'),
  units: item.units.join(', '),
  periodicity: item.periodicity || '',
  plannedResearchCount: String(item.plannedResearchCount),
  methodology: item.methodology || '',
  laboratoryId: item.laboratory?.id ? String(item.laboratory.id) : '',
  protocolIds: item.linkedProtocols.map((protocol) => protocol.id),
});
const requestFromForm = (form: FormState, version: number, original?: PekMonitoringDirection): PekMonitoringMutationRequest => ({
  version,
  monitoringType: form.monitoringType as PekMonitoringType,
  controlPoints: original && form.controlPoints === original.controlPoints.map(rowLabel).join('\n') ? original.controlPoints : lines(form.controlPoints, 'name'),
  indicators: original && form.indicators === original.indicators.map(rowLabel).join('\n') ? original.indicators : lines(form.indicators, 'indicatorName'),
  normatives: original && form.normatives === original.normatives.map(rowLabel).join('\n') ? original.normatives : lines(form.normatives, 'value'),
  units: form.units.split(',').map((item) => item.trim()).filter(Boolean),
  periodicity: form.periodicity.trim() || null,
  plannedResearchCount: Math.max(0, Number(form.plannedResearchCount) || 0),
  methodology: form.methodology.trim() || null,
  laboratoryId: form.laboratoryId ? Number(form.laboratoryId) : null,
  protocolIds: form.protocolIds,
});

const PekProgramMonitoring = ({ program }: { program: PekProgram }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = pekKeys.programMonitoring(program.id, program.company?.id, user?.id);
  const monitoring = useQuery({ queryKey, queryFn: ({ signal }) => pekApi.getProgramMonitoring(program.id, signal) });
  const [activeId, setActiveId] = useState<number>();
  const [section, setSection] = useState<(typeof sections)[number]>('Точки контроля');
  const [editing, setEditing] = useState<PekMonitoringDirection | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleting, setDeleting] = useState<PekMonitoringDirection | null>(null);
  useEffect(() => {
    if (!activeId && monitoring.data?.items.length) setActiveId(monitoring.data.items[0].id);
    if (activeId && monitoring.data && !monitoring.data.items.some((item) => item.id === activeId)) setActiveId(monitoring.data.items[0]?.id);
  }, [activeId, monitoring.data]);
  const active = monitoring.data?.items.find((item) => item.id === activeId) || monitoring.data?.items[0];
  const refresh = async () => {
    const result = await pekApi.getProgramMonitoring(program.id);
    queryClient.setQueryData(queryKey, result);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: pekKeys.programDetail(program.company?.id, program.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportsRoot(program.company?.id, user?.id) }),
    ]);
    return result;
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!form.monitoringType || !monitoring.data) throw new Error('Выберите направление мониторинга.');
      if (editing === 'new') await pekApi.createProgramMonitoring(program.id, requestFromForm(form, monitoring.data.version || program.version));
      else if (editing) await pekApi.updateProgramMonitoring(program.id, editing.id, requestFromForm(form, editing.version, editing));
      return refresh();
    },
    onSuccess: (result) => { setEditing(null); const selected = result.items.find((item) => item.monitoringType === form.monitoringType); if (selected) setActiveId(selected.id); },
    onError: (error) => { const mapped = mapPekError(error); if (mapped.status === 409 || mapped.status === 412) void refresh(); },
  });
  const remove = useMutation({
    mutationFn: async () => { if (!deleting) return; await pekApi.deleteProgramMonitoring(program.id, deleting.id, deleting.version); return refresh(); },
    onSuccess: () => setDeleting(null),
    onError: (error) => { const mapped = mapPekError(error); if (mapped.status === 409 || mapped.status === 412) void refresh(); },
  });
  const failure = save.error || remove.error;
  const mappedFailure = failure ? mapPekError(failure) : null;
  const availableTypes = useMemo(() => (monitoring.data?.availableTypes || []).filter((type) => type.enabled && !monitoring.data?.items.some((item) => item.monitoringType === type.code)), [monitoring.data]);
  const openCreate = () => { setForm({ ...emptyForm, monitoringType: availableTypes[0]?.code || '' }); setEditing('new'); };
  const openEdit = (item: PekMonitoringDirection) => { setForm(formFromDirection(item)); setEditing(item); };

  if (monitoring.isLoading) return <section className="rounded-2xl border bg-white p-5">Загружаем направления мониторинга…</section>;
  if (monitoring.isError || !monitoring.data) return <PekQueryError error={monitoring.error} resource="направления мониторинга" retry={() => void monitoring.refetch()} />;
  const canCreate = monitoring.data.availableActions.create === true;

  return <section className="space-y-4 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black">Направления мониторинга</h2><p className="text-sm text-slate-500">Типы и допустимые действия получены с backend. Лабораторные протоколы остаются в разделе «Протоколы».</p></div>{canCreate && availableTypes.length > 0 && <Button variant="contained" onClick={openCreate}>Добавить направление</Button>}</div>
    {monitoring.data.missingFields.length > 0 && <Alert severity="warning"><strong>Заполните обязательные данные:</strong><ul className="mt-2 list-disc pl-5">{monitoring.data.missingFields.map((field) => <li key={field}>{field}</li>)}</ul></Alert>}
    {mappedFailure && <Alert severity="error">{mappedFailure.message}</Alert>}
    {!monitoring.data.items.length ? <Alert severity="info">В программу ещё не включено ни одного направления мониторинга.</Alert> : <>
      <nav className="flex gap-2 overflow-x-auto" aria-label="Направления мониторинга">{monitoring.data.items.map((item) => <button key={item.id} type="button" onClick={() => { setActiveId(item.id); setSection('Точки контроля'); }} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${active?.id === item.id ? 'bg-eco-700 text-white' : 'border bg-white text-slate-700'}`}>{item.typeLabel}</button>)}</nav>
      {active && <article className="space-y-4 rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-black">{active.typeLabel}</h3><p className="text-sm text-slate-500">План: {active.plannedResearchCount} · Факт: {active.actualResearchCount} · Лаборатория: {active.laboratory?.name || 'не выбрана'}</p></div><div className="flex gap-2">{active.availableActions.edit === true && <Button size="small" variant="outlined" onClick={() => openEdit(active)}>Изменить</Button>}{active.availableActions.delete === true && <Button size="small" color="error" onClick={() => setDeleting(active)}>Удалить</Button>}</div></div>
        {active.missingFields.length > 0 && <Alert severity="warning">Не заполнено: {active.missingFields.join(', ')}</Alert>}
        <nav className="flex gap-1 overflow-x-auto border-b">{sections.map((name) => <button key={name} type="button" onClick={() => setSection(name)} className={`whitespace-nowrap px-3 py-2 text-sm font-bold ${section === name ? 'border-b-2 border-eco-600 text-eco-800' : 'text-slate-500'}`}>{name}</button>)}</nav>
        {section === 'Точки контроля' && <Rows values={active.controlPoints} />}
        {section === 'Показатели' && <Rows values={active.indicators} />}
        {section === 'Нормативы' && <Rows values={active.normatives} />}
        {section === 'Периодичность' && <InfoGrid values={[['Периодичность', active.periodicity || '—'], ['Методика', active.methodology || '—'], ['Единицы', active.units.join(', ') || '—']]} />}
        {section === 'План' && <InfoGrid values={[['Плановое количество исследований', active.plannedResearchCount]]} />}
        {section === 'Факт' && <div className="space-y-3"><InfoGrid values={[['Фактическое количество исследований', active.actualResearchCount]]} /><Rows values={active.results} /></div>}
        {section === 'Протоколы' && <div className="space-y-2">{active.linkedProtocols.map((protocol) => <Link key={protocol.id} to={`/staff/protocols/${protocol.id}`} className="flex flex-wrap justify-between gap-2 rounded-xl border p-3 hover:bg-slate-50"><strong>{protocol.number || `Протокол №${protocol.id}`}</strong><span>{protocol.protocolTypeLabel || protocol.protocolType || 'Тип определён backend'} · {protocol.status || '—'}</span></Link>)}{!active.linkedProtocols.length && <p className="text-slate-500">Подходящие протоколы ещё не привязаны.</p>}</div>}
        {section === 'Превышения' && <div className="space-y-3"><Rows values={active.exceedances} /><h4 className="font-bold">Мероприятия</h4><Rows values={active.measures} /></div>}
      </article>}
    </>}
    <Dialog open={Boolean(editing)} onClose={() => !save.isPending && setEditing(null)} fullWidth maxWidth="md"><DialogTitle>{editing === 'new' ? 'Добавить направление мониторинга' : 'Изменить направление мониторинга'}</DialogTitle><DialogContent><div className="mt-2 grid gap-4 sm:grid-cols-2">
      <TextField select label="Направление *" value={form.monitoringType} disabled={editing !== 'new'} onChange={(event) => setForm((current) => ({ ...current, monitoringType: event.target.value as PekMonitoringType }))}>{(editing === 'new' ? availableTypes : editing ? [{ code: editing.monitoringType, label: editing.typeLabel, enabled: true }] : []).map((type) => <MenuItem key={type.code} value={type.code}>{type.label}</MenuItem>)}</TextField>
      <TextField label="Периодичность" value={form.periodicity} onChange={(event) => setForm((current) => ({ ...current, periodicity: event.target.value }))} />
      <TextField label="Плановое количество" type="number" inputProps={{ min: 0 }} value={form.plannedResearchCount} onChange={(event) => setForm((current) => ({ ...current, plannedResearchCount: event.target.value }))} />
      <TextField label="ID лаборатории" type="number" value={form.laboratoryId} onChange={(event) => setForm((current) => ({ ...current, laboratoryId: event.target.value }))} />
      <TextField className="sm:col-span-2" label="Точки контроля, по одной в строке" multiline minRows={3} value={form.controlPoints} onChange={(event) => setForm((current) => ({ ...current, controlPoints: event.target.value }))} />
      <TextField label="Показатели, по одному в строке" multiline minRows={3} value={form.indicators} onChange={(event) => setForm((current) => ({ ...current, indicators: event.target.value }))} />
      <TextField label="Нормативы, по одному в строке" multiline minRows={3} value={form.normatives} onChange={(event) => setForm((current) => ({ ...current, normatives: event.target.value }))} />
      <TextField label="Единицы через запятую" value={form.units} onChange={(event) => setForm((current) => ({ ...current, units: event.target.value }))} />
      <TextField label="Методика" value={form.methodology} onChange={(event) => setForm((current) => ({ ...current, methodology: event.target.value }))} />
      {editing !== 'new' && (editing as PekMonitoringDirection).compatibleProtocols.length > 0 && <div className="sm:col-span-2"><p className="mb-2 font-bold">Совместимые Protocol</p>{(editing as PekMonitoringDirection).compatibleProtocols.map((protocol) => <FormControlLabel key={protocol.id} control={<Checkbox checked={form.protocolIds.includes(protocol.id)} onChange={(event) => setForm((current) => ({ ...current, protocolIds: event.target.checked ? [...current.protocolIds, protocol.id] : current.protocolIds.filter((id) => id !== protocol.id) }))} />} label={`${protocol.number || `№${protocol.id}`} · ${protocol.protocolTypeLabel || protocol.protocolType || ''}`} />)}</div>}
    </div></DialogContent><DialogActions><Button disabled={save.isPending} onClick={() => setEditing(null)}>Отмена</Button><Button variant="contained" disabled={!form.monitoringType || save.isPending} onClick={() => save.mutate()}>Сохранить</Button></DialogActions></Dialog>
    <Dialog open={Boolean(deleting)} onClose={() => !remove.isPending && setDeleting(null)}><DialogTitle>Удалить направление?</DialogTitle><DialogContent>Направление «{deleting?.typeLabel}» будет удалено из программы. Лабораторные Protocol удалены не будут.</DialogContent><DialogActions><Button disabled={remove.isPending} onClick={() => setDeleting(null)}>Отмена</Button><Button color="error" variant="contained" disabled={remove.isPending} onClick={() => remove.mutate()}>Удалить</Button></DialogActions></Dialog>
  </section>;
};

const Rows = ({ values }: { values: Array<Record<string, unknown>> }) => <div className="space-y-2">{values.map((row, index) => <div key={String(row.id ?? row.code ?? index)} className="rounded-xl bg-slate-50 p-3"><strong>{rowLabel(row)}</strong>{row.description ? <p className="text-sm text-slate-600">{String(row.description)}</p> : null}</div>)}{!values.length && <p className="text-slate-500">Данные отсутствуют.</p>}</div>;
const InfoGrid = ({ values }: { values: Array<[string, string | number]> }) => <div className="grid gap-3 sm:grid-cols-3">{values.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div>;

export default PekProgramMonitoring;
