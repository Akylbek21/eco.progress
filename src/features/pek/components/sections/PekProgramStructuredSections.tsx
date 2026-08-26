import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField } from '@mui/material';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import type {
  PekEmergencyProcedure,
  PekEmergencyProcedureRequest,
  PekInternalInspection,
  PekInternalInspectionRequest,
  PekMeasurementQa,
  PekMeasurementQaRequest,
  PekProgram,
  PekResponsibility,
  PekResponsibilityRequest,
} from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';
import { handlePekMutationError } from '../../utils/pekMutationError';

export type PekStructuredSectionKey = 'internal-inspections' | 'measurement-qa' | 'emergency-procedures' | 'responsibilities';

type VersionedItem = { id: number; version: number };
type Setter<T> = <K extends keyof T>(key: K, value: T[K]) => void;
type SectionDefinition<T extends VersionedItem, TForm> = {
  key: string;
  title: string;
  description: string;
  addLabel: string;
  empty: () => TForm;
  toForm: (item: T) => TForm;
  query: (signal?: AbortSignal) => Promise<T[]>;
  create: (form: TForm) => Promise<T>;
  update: (item: T, form: TForm) => Promise<T>;
  remove: (item: T) => Promise<unknown>;
  valid: (form: TForm) => boolean;
  summary: (item: T) => ReactNode;
  fields: (form: TForm, set: Setter<TForm>) => ReactNode;
};

const StructuredSection = <T extends VersionedItem, TForm,>({ program, definition }: { program: PekProgram; definition: SectionDefinition<T, TForm> }) => {
  const client = useQueryClient();
  const queryKey = pekKeys.programSection(program.id, definition.key);
  const query = useQuery({ queryKey, queryFn: ({ signal }) => definition.query(signal) });
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [form, setForm] = useState<TForm>(definition.empty);
  const editable = program.availableActions.edit === true;
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey }),
      client.invalidateQueries({ queryKey: pekKeys.programDetail(program.company?.id, program.id) }),
    ]);
  };
  const save = useMutation({
    mutationFn: () => editing === 'new' ? definition.create(form) : definition.update(editing as T, form),
    onSuccess: async () => { setEditing(null); await refresh(); },
    onError: (error) => { void handlePekMutationError(error, refresh); },
    retry: false,
  });
  const remove = useMutation({
    mutationFn: () => definition.remove(deleting!),
    onSuccess: async () => { setDeleting(null); await refresh(); },
    onError: (error) => { void handlePekMutationError(error, refresh); },
    retry: false,
  });
  const set: Setter<TForm> = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const openCreate = () => { setForm(definition.empty()); setEditing('new'); };
  const openEdit = (item: T) => { setForm(definition.toForm(item)); setEditing(item); };

  return <section className="space-y-4 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">{definition.title}</h2><p className="text-sm text-slate-500">{definition.description}</p></div>{editable && <Button variant="contained" onClick={openCreate}>{definition.addLabel}</Button>}</div>
    {query.isError && <Alert severity="error">{mapPekError(query.error).message}</Alert>}
    {query.isLoading && <p className="text-sm text-slate-500">Загрузка…</p>}
    {query.data && !query.data.length && <Alert severity="info">Записи пока не добавлены.</Alert>}
    <div className="grid gap-3">{query.data?.map((item) => <article key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4"><div className="min-w-0 flex-1">{definition.summary(item)}</div>{editable && <div className="flex gap-2"><Button size="small" onClick={() => openEdit(item)}>Изменить</Button><Button size="small" color="error" onClick={() => setDeleting(item)}>Удалить</Button></div>}</article>)}</div>
    <Dialog open={Boolean(editing)} onClose={() => !save.isPending && setEditing(null)} fullWidth maxWidth="md">
      <DialogTitle>{editing === 'new' ? definition.addLabel : `Изменить: ${definition.title.toLowerCase()}`}</DialogTitle>
      <DialogContent><div className="mt-2 grid gap-4 sm:grid-cols-2">{definition.fields(form, set)}{save.isError && <Alert className="sm:col-span-2" severity="error">{mapPekError(save.error).message}</Alert>}</div></DialogContent>
      <DialogActions><Button onClick={() => setEditing(null)}>Отмена</Button><Button variant="contained" disabled={save.isPending || !definition.valid(form)} onClick={() => save.mutate()}>Сохранить</Button></DialogActions>
    </Dialog>
    <Dialog open={Boolean(deleting)} onClose={() => !remove.isPending && setDeleting(null)}><DialogTitle>Удалить запись?</DialogTitle>{remove.isError && <DialogContent><Alert severity="error">{mapPekError(remove.error).message}</Alert></DialogContent>}<DialogActions><Button onClick={() => setDeleting(null)}>Отмена</Button><Button color="error" disabled={remove.isPending} onClick={() => remove.mutate()}>Удалить</Button></DialogActions></Dialog>
  </section>;
};

const AssigneeField = ({ value, onChange, options }: { value: number | null; onChange: (value: number | null) => void; options: Array<{ id: number; name: string }> }) => <TextField select label="Ответственный" value={value ?? ''} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}><MenuItem value="">Не выбран</MenuItem>{options.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField>;
const TextSummary = ({ title, details }: { title: string; details: ReactNode }) => <><h3 className="font-black">{title}</h3><div className="mt-2 text-sm text-slate-600">{details}</div></>;
const PekProgramStructuredSections = ({ program, section }: { program: PekProgram; section?: PekStructuredSectionKey }) => {
  const { user } = useAuth();
  const companyId = program.company?.id || 0;
  const assignees = useQuery({ queryKey: pekKeys.assignees(companyId, ['PEK_RESPONSIBLE'], user?.id), queryFn: ({ signal }) => pekApi.getAssignees(companyId, ['PEK_RESPONSIBLE'], signal), enabled: companyId > 0 });
  const users = (assignees.data || []).map((item) => ({ id: item.id, name: item.name }));

  const inspection: SectionDefinition<PekInternalInspection, PekInternalInspectionRequest> = {
    key: 'internal-inspections', title: 'Внутренние проверки', description: 'План, факт, результаты и корректирующие действия.', addLabel: 'Добавить проверку',
    empty: () => ({ plannedDate: null, actualDate: null, inspectionType: '', findings: '', correctiveActionRequired: false, responsibleUserId: null, status: 'PLANNED' }),
    toForm: ({ plannedDate, actualDate, inspectionType, findings, correctiveActionRequired, responsibleUserId, status }) => ({ plannedDate, actualDate, inspectionType, findings, correctiveActionRequired, responsibleUserId, status }),
    query: (signal) => pekApi.getInternalInspections(program.id, signal), create: (form) => pekApi.createInternalInspection(program.id, form), update: (item, form) => pekApi.updateInternalInspection(program.id, item.id, item.version, form), remove: (item) => pekApi.deleteInternalInspection(program.id, item.id, item.version),
    valid: (form) => Boolean(form.plannedDate && form.inspectionType?.trim()),
    summary: (item) => <TextSummary title={item.inspectionType || 'Проверка'} details={<><p>{item.plannedDate || 'Без даты'} · {item.status}</p><p>{item.findings || 'Результаты не указаны'}</p></>} />,
    fields: (form, set) => <><TextField type="date" label="Плановая дата *" InputLabelProps={{ shrink: true }} value={form.plannedDate || ''} onChange={(e) => set('plannedDate', e.target.value || null)} /><TextField type="date" label="Фактическая дата" InputLabelProps={{ shrink: true }} value={form.actualDate || ''} onChange={(e) => set('actualDate', e.target.value || null)} /><TextField label="Тип проверки *" value={form.inspectionType || ''} onChange={(e) => set('inspectionType', e.target.value)} /><TextField select label="Статус" value={form.status} onChange={(e) => set('status', e.target.value)}>{['PLANNED', 'COMPLETED', 'OVERDUE', 'CANCELLED'].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</TextField><AssigneeField value={form.responsibleUserId} options={users} onChange={(value) => set('responsibleUserId', value)} /><FormControlLabel control={<Checkbox checked={form.correctiveActionRequired} onChange={(e) => set('correctiveActionRequired', e.target.checked)} />} label="Требуется корректирующее действие" /><TextField className="sm:col-span-2" multiline minRows={3} label="Результаты" value={form.findings || ''} onChange={(e) => set('findings', e.target.value)} /></>,
  };
  const qa: SectionDefinition<PekMeasurementQa, PekMeasurementQaRequest> = {
    key: 'measurement-qa', title: 'QA/QC измерений', description: 'Процедуры обеспечения качества измерений и сроки контроля.', addLabel: 'Добавить QA/QC',
    empty: () => ({ parameter: '', qaProcedure: '', frequency: '', responsibleUserId: null, lastCheckDate: null, nextCheckDate: null }),
    toForm: ({ parameter, qaProcedure, frequency, responsibleUserId, lastCheckDate, nextCheckDate }) => ({ parameter, qaProcedure, frequency, responsibleUserId, lastCheckDate, nextCheckDate }),
    query: (signal) => pekApi.getMeasurementQa(program.id, signal), create: (form) => pekApi.createMeasurementQa(program.id, form), update: (item, form) => pekApi.updateMeasurementQa(program.id, item.id, item.version, form), remove: (item) => pekApi.deleteMeasurementQa(program.id, item.id, item.version), valid: (form) => Boolean(form.parameter.trim()),
    summary: (item) => <TextSummary title={item.parameter} details={<><p>{item.qaProcedure || 'Процедура не указана'}</p><p>{item.frequency || 'Без периодичности'} · следующая проверка: {item.nextCheckDate || '—'}</p></>} />,
    fields: (form, set) => <><TextField label="Параметр *" value={form.parameter} onChange={(e) => set('parameter', e.target.value)} /><TextField label="Периодичность" value={form.frequency || ''} onChange={(e) => set('frequency', e.target.value)} /><AssigneeField value={form.responsibleUserId} options={users} onChange={(value) => set('responsibleUserId', value)} /><TextField type="date" label="Последняя проверка" InputLabelProps={{ shrink: true }} value={form.lastCheckDate || ''} onChange={(e) => set('lastCheckDate', e.target.value || null)} /><TextField type="date" label="Следующая проверка" InputLabelProps={{ shrink: true }} value={form.nextCheckDate || ''} onChange={(e) => set('nextCheckDate', e.target.value || null)} /><TextField className="sm:col-span-2" multiline minRows={3} label="Процедура QA/QC" value={form.qaProcedure || ''} onChange={(e) => set('qaProcedure', e.target.value)} /></>,
  };
  const emergency: SectionDefinition<PekEmergencyProcedure, PekEmergencyProcedureRequest> = {
    key: 'emergency-procedures', title: 'Аварийные процедуры', description: 'Сценарии, порядок действий и контакты ответственных.', addLabel: 'Добавить сценарий',
    empty: () => ({ scenario: '', actions: '', responsibleUserId: null, contactPhone: '' }), toForm: ({ scenario, actions, responsibleUserId, contactPhone }) => ({ scenario, actions, responsibleUserId, contactPhone }),
    query: (signal) => pekApi.getEmergencyProcedures(program.id, signal), create: (form) => pekApi.createEmergencyProcedure(program.id, form), update: (item, form) => pekApi.updateEmergencyProcedure(program.id, item.id, item.version, form), remove: (item) => pekApi.deleteEmergencyProcedure(program.id, item.id, item.version), valid: (form) => Boolean(form.scenario.trim()),
    summary: (item) => <TextSummary title={item.scenario} details={<><p>{item.actions || 'Действия не указаны'}</p><p>Телефон: {item.contactPhone || '—'}</p></>} />,
    fields: (form, set) => <><TextField label="Сценарий *" value={form.scenario} onChange={(e) => set('scenario', e.target.value)} /><TextField label="Контактный телефон" value={form.contactPhone || ''} onChange={(e) => set('contactPhone', e.target.value)} /><AssigneeField value={form.responsibleUserId} options={users} onChange={(value) => set('responsibleUserId', value)} /><TextField className="sm:col-span-2" multiline minRows={4} label="Порядок действий" value={form.actions || ''} onChange={(e) => set('actions', e.target.value)} /></>,
  };
  const responsibility: SectionDefinition<PekResponsibility, PekResponsibilityRequest> = {
    key: 'responsibilities', title: 'Матрица ответственности', description: 'Роли, сотрудники и закреплённые обязанности.', addLabel: 'Добавить ответственность',
    empty: () => ({ roleLabel: '', userId: null, duties: '' }), toForm: ({ roleLabel, userId, duties }) => ({ roleLabel, userId, duties }),
    query: (signal) => pekApi.getResponsibilities(program.id, signal), create: (form) => pekApi.createResponsibility(program.id, form), update: (item, form) => pekApi.updateResponsibility(program.id, item.id, item.version, form), remove: (item) => pekApi.deleteResponsibility(program.id, item.id, item.version), valid: (form) => Boolean(form.roleLabel.trim()),
    summary: (item) => <TextSummary title={item.roleLabel} details={<><p>{users.find((candidate) => candidate.id === item.userId)?.name || `Сотрудник: ${item.userId || 'не выбран'}`}</p><p>{item.duties || 'Обязанности не указаны'}</p></>} />,
    fields: (form, set) => <><TextField label="Роль *" value={form.roleLabel} onChange={(e) => set('roleLabel', e.target.value)} /><AssigneeField value={form.userId} options={users} onChange={(value) => set('userId', value)} /><TextField className="sm:col-span-2" multiline minRows={4} label="Обязанности" value={form.duties || ''} onChange={(e) => set('duties', e.target.value)} /></>,
  };

  const definitions = [inspection, qa, emergency, responsibility];
  return <div className="space-y-5">
    {definitions.filter((definition) => !section || definition.key === section).map((definition) => (
      <StructuredSection key={definition.key} program={program} definition={definition as never} />
    ))}
  </div>;
};

export default PekProgramStructuredSections;
