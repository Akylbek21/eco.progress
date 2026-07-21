import { useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Archive, Download, Edit3, FileDown, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { getActiveLaboratories } from '../services/laboratorySettingsService';
import { archiveEntry, createEntry, downloadTemplate, exportJournal, getEntries, getEntry, getJournalTypesResult, restoreEntry, updateEntry } from '../services/labJournalService';
import { JOURNAL_TYPES, JournalType, type JournalColumn, type JournalEntry, type JournalTypeDefinition, type JournalValues, type LabJournalType } from '../types/labJournal';
import { buildJournalEntryPayload } from '../utils/journalSchema';
import { formatJournalValue } from '../utils/journalFormat';
import { parseJournalApiError } from '../utils/journalApiError';
import { canArchiveJournalEntry, canCreateJournalEntry, canEditJournalEntry, canExportJournal, canRestoreJournalEntry, canViewJournals } from '../utils/journalPermissions';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100';
const pageSizes = [10, 25, 50, 100];
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const validTypes = new Set<LabJournalType>(Object.values(JournalType));
const automaticReadOnlyKeys = new Set(['protocolId', 'companyId', 'companyObjectId', 'sampleNumber', 'indicatorName', 'resultValue', 'unit', 'normativeValue', 'normativeDocument', 'compliance', 'executorEmployeeId', 'approvedByEmployeeId']);
const extraFilters: Partial<Record<LabJournalType, Array<{ key: string; label: string }>>> = {
  SAMPLE_REGISTRATION: [{ key: 'sampleNumber', label: 'Номер пробы' }, { key: 'company', label: 'Заказчик' }, { key: 'object', label: 'Объект' }],
  SOLUTION_PREPARATION: [{ key: 'solutionName', label: 'Название раствора' }, { key: 'preparedBy', label: 'Приготовил' }],
  CHEMICAL_REAGENT_MOVEMENT: [{ key: 'reagent', label: 'Реактив' }, { key: 'batchNumber', label: 'Партия' }, { key: 'operationType', label: 'Тип операции' }],
  ENVIRONMENT_CONDITIONS: [{ key: 'room', label: 'Помещение' }, { key: 'measuredBy', label: 'Измерил' }],
  TEST_RESULTS_REGISTRATION: [{ key: 'protocolNumber', label: 'Номер протокола' }, { key: 'company', label: 'Заказчик' }, { key: 'indicator', label: 'Показатель' }, { key: 'executor', label: 'Исполнитель' }],
};

const downloadBlob = ({ blob, fileName }: { blob: Blob; fileName: string }) => {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
};

type JournalForm = { values: JournalValues };
type EntryFormProps = { definition: JournalTypeDefinition; laboratoryId: number; entry?: JournalEntry; saving: boolean; onDirtyChange: (dirty: boolean) => void; onRefresh: () => Promise<void>; onClose: () => void; onSaved: (entry: JournalEntry) => void };

const EntryForm = ({ definition, laboratoryId, entry, saving, onDirtyChange, onRefresh, onClose, onSaved }: EntryFormProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const busy = saving || submitting;
  const defaults = useMemo(() => {
    const values: JournalValues = { ...(entry?.values || {}) };
    if (!entry) ['registrationDate', 'preparationDate', 'operationDate'].forEach((key) => { if (definition.columns.some((column) => column.key === key)) values[key] = today(); });
    return { values };
  }, [definition, entry]);
  const { register, handleSubmit, reset, setError, formState: { errors, isDirty } } = useForm<JournalForm>({ defaultValues: defaults });
  useEffect(() => reset(defaults), [defaults, reset]);
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);
  useEffect(() => { if (!isDirty) return undefined; const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [isDirty]);
  const close = () => { if (!busy && (!isDirty || window.confirm('Есть несохранённые изменения. Закрыть форму?'))) onClose(); };
  const submit = handleSubmit(async ({ values }) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = buildJournalEntryPayload(definition, laboratoryId, values, entry?.version);
      const saved = entry ? await updateEntry(entry.id, payload) : await createEntry(payload);
      reset({ values: saved.values }); onSaved(saved);
    } catch (error) {
      const parsed = parseJournalApiError(error);
      if (parsed.status === 409 || parsed.code === 'OPTIMISTIC_LOCK_CONFLICT') setConflict(true);
      Object.entries(parsed.fieldErrors || {}).forEach(([field, message]) => {
        const key = field.replace(/^values\./, '');
        if (definition.columns.some((column) => column.key === key)) setError(`values.${key}` as `values.${string}`, { type: 'server', message });
      });
      setError('root', { type: 'server', message: parsed.message });
    } finally { setSubmitting(false); }
  });

  const renderField = (column: JournalColumn) => {
    const name = `values.${column.key}` as `values.${string}`;
    const readOnly = column.readOnly || column.type === 'calculated' || Boolean(entry?.automatic && automaticReadOnlyKeys.has(column.key));
    const rules = { required: column.required ? `Заполните поле «${column.title}»` : false, pattern: column.validation?.pattern ? { value: new RegExp(column.validation.pattern), message: 'Проверьте формат значения' } : undefined };
    if (column.type === 'textarea') return <textarea {...register(name, rules)} rows={3} disabled={busy || readOnly} className={inputClass} />;
    if (column.type === 'boolean') return <input type="checkbox" {...register(name)} disabled={busy || readOnly} className="h-5 w-5 rounded border-slate-300" />;
    if (column.type === 'select' || column.type === 'employee' || column.type === 'laboratory' || column.type === 'measurement_device' || column.type === 'company' || column.type === 'company_object' || column.type === 'protocol') return <select {...register(name, rules)} disabled={busy || readOnly} className={inputClass}><option value="">Не выбрано</option>{column.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
    if (column.type === 'number' || column.type === 'calculated') return <input type="text" inputMode="decimal" {...register(name, { ...rules, validate: (value) => { if (value === undefined || value === null || value === '') return true; const numeric = Number(String(value).replace(',', '.')); if (!Number.isFinite(numeric)) return 'Введите число'; if (column.validation?.min !== undefined && numeric < column.validation.min) return `Минимальное значение: ${column.validation.min}`; if (column.validation?.max !== undefined && numeric > column.validation.max) return `Максимальное значение: ${column.validation.max}`; return true; }, setValueAs: (value) => value === '' ? undefined : value })} disabled={busy || readOnly} className={inputClass} />;
    return <input type={column.type === 'date' || column.type === 'time' || column.type === 'datetime' ? column.type === 'datetime' ? 'datetime-local' : column.type : 'text'} {...register(name, rules)} disabled={busy || readOnly} className={inputClass} />;
  };

  return <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
    {entry?.automatic && <div className="rounded-xl bg-sky-50 p-3 text-sm text-sky-900 md:col-span-2">Запись создана автоматически из протокола. Связанные результаты доступны только для чтения.{entry.protocolId && <> <Link className="font-bold underline" to={`/staff/protocols/${entry.protocolId}`}>Открыть протокол</Link></>}</div>}
    {conflict && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 md:col-span-2"><p className="font-semibold text-amber-900">Запись была изменена другим сотрудником</p><div className="mt-3 flex gap-2"><Button type="button" variant="secondary" onClick={async () => { await onRefresh(); setConflict(false); }}>Обновить данные</Button><Button type="button" variant="secondary" onClick={close}>Закрыть</Button></div></div>}
    {errors.root?.message && <div className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800 md:col-span-2">{errors.root.message}</div>}
    {definition.columns.map((column) => <label key={column.key} className={`space-y-1 text-sm font-semibold text-slate-700 ${column.type === 'textarea' ? 'md:col-span-2' : ''}`}><span>{column.title}{column.required ? ' *' : ''}</span>{renderField(column)}{errors.values?.[column.key]?.message && <span className="block text-xs text-rose-700">{String(errors.values[column.key]?.message)}</span>}</label>)}
    <div className="flex justify-end gap-3 border-t pt-4 md:col-span-2"><Button type="button" variant="secondary" disabled={busy} onClick={close}>Отмена</Button><Button type="submit" disabled={busy}>{busy ? 'Сохранение...' : 'Сохранить'}</Button></div>
  </form>;
};

const LabJournalsPage = () => {
  const { user } = useAuth(); const toast = useToast(); const queryClient = useQueryClient(); const [params, setParams] = useSearchParams();
  const urlType = params.get('type') as LabJournalType | null; const journalType = urlType && validTypes.has(urlType) ? urlType : JournalType.SAMPLE_REGISTRATION;
  const page = Math.max(0, Number(params.get('page') || 0)); const requestedSize = Number(params.get('size') || 25); const size = pageSizes.includes(requestedSize) ? requestedSize : 25;
  const laboratoryId = Number(params.get('laboratoryId') || 0); const status = params.get('archived') || 'ACTIVE'; const dateFrom = params.get('dateFrom') || ''; const dateTo = params.get('dateTo') || ''; const sort = params.get('sort') || 'createdAt,desc';
  const [searchDraft, setSearchDraft] = useState(params.get('search') || ''); const [search, setSearch] = useState(params.get('search') || '');
  const [editorOpen, setEditorOpen] = useState(false); const [editingId, setEditingId] = useState<number>(); const [saving] = useState(false); const [formDirty, setFormDirty] = useState(false); const [confirmEntry, setConfirmEntry] = useState<JournalEntry>(); const [mutationBusy, setMutationBusy] = useState(false); const [downloadBusy, setDownloadBusy] = useState<'excel' | 'template' | ''>(); const [templateSupported, setTemplateSupported] = useState(true);
  const updateUrl = useCallback((patch: Record<string, string | number | undefined>) => { const next = new URLSearchParams(params); Object.entries(patch).forEach(([key, value]) => value === undefined || value === '' ? next.delete(key) : next.set(key, String(value))); setParams(next, { replace: true }); }, [params, setParams]);
  useEffect(() => { if (!params.has('type')) updateUrl({ type: journalType, page, size, archived: status }); }, [params, journalType, page, size, status, updateUrl]);
  useEffect(() => { const timer = window.setTimeout(() => { const value = searchDraft.trim(); setSearch(value); updateUrl({ search: value || undefined, page: 0 }); }, 450); return () => window.clearTimeout(timer); }, [searchDraft]);

  const typesQuery = useQuery({ queryKey: ['journal-types'], queryFn: ({ signal }) => getJournalTypesResult(signal), staleTime: 30 * 60_000, retry: false });
  const definitions = typesQuery.data?.items || []; const definition = definitions.find((item) => item.code === journalType);
  const labsQuery = useQuery({ queryKey: ['laboratories', 'journal-options'], queryFn: ({ signal }) => getActiveLaboratories(signal), staleTime: 5 * 60_000 });
  useEffect(() => { const labs = labsQuery.data || []; if ((!laboratoryId || !labs.some((item) => item.id === laboratoryId)) && labs.length === 1) updateUrl({ laboratoryId: labs[0].id, page: 0 }); }, [labsQuery.data, laboratoryId]);
  useEffect(() => { if (user?.role !== 'LABORATORY' || !labsQuery.data?.length) return; if (!labsQuery.data.some((item) => item.id === laboratoryId)) updateUrl({ laboratoryId: labsQuery.data[0].id, page: 0 }); }, [user?.role, labsQuery.data, laboratoryId]);
  const laboratoryAllowed = user?.role !== 'LABORATORY' || Boolean(labsQuery.data?.some((item) => item.id === laboratoryId));
  const dynamicFilters = useMemo(() => Object.fromEntries((extraFilters[journalType] || []).map(({ key }) => [key, params.get(`f_${key}`) || '']).filter(([, value]) => value)), [journalType, params]);
  const entriesQuery = useQuery({ queryKey: ['journal-entries', { journalType, laboratoryId, page, size, search, dateFrom, dateTo, status, sort, dynamicFilters }], queryFn: ({ signal }) => getEntries({ journalType, laboratoryId: laboratoryId || undefined, page, size, search: search || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, archived: status === 'ALL' ? undefined : status === 'ARCHIVED', sort, filters: dynamicFilters }, signal), enabled: Boolean(definition && laboratoryId && laboratoryAllowed && (!dateFrom || !dateTo || dateFrom <= dateTo)), placeholderData: keepPreviousData });
  const entryQuery = useQuery({ queryKey: ['journal-entry', editingId], queryFn: ({ signal }) => getEntry(editingId!, signal), enabled: editorOpen && editingId !== undefined });
  const entries = entriesQuery.data?.items || []; const hasFilters = Boolean(search || dateFrom || dateTo || status !== 'ACTIVE' || Object.keys(dynamicFilters).length);

  if (!canViewJournals(user)) return <div className="rounded-xl bg-amber-50 p-5 font-semibold text-amber-900">Недостаточно прав для просмотра журналов</div>;
  const saveCompleted = async (saved: JournalEntry) => { setFormDirty(false); setEditorOpen(false); setEditingId(undefined); await Promise.all([queryClient.invalidateQueries({ queryKey: ['journal-entries'] }), queryClient.setQueryData(['journal-entry', saved.id], saved)]); toast.success('Запись журнала сохранена'); };
  const archiveOrRestore = async () => { if (!confirmEntry || mutationBusy) return; setMutationBusy(true); try { if (confirmEntry.archived) await restoreEntry(confirmEntry.id); else await archiveEntry(confirmEntry.id); if (!confirmEntry.archived && entries.length === 1 && page > 0) updateUrl({ page: page - 1 }); await queryClient.invalidateQueries({ queryKey: ['journal-entries'] }); toast.success(confirmEntry.archived ? 'Запись восстановлена' : 'Запись архивирована'); setConfirmEntry(undefined); } catch (error) { toast.error(parseJournalApiError(error).message); } finally { setMutationBusy(false); } };
  const runDownload = async (kind: 'excel' | 'template') => { if (downloadBusy) return; setDownloadBusy(kind); try { const result = kind === 'template' ? await downloadTemplate(journalType) : await exportJournal({ journalType, laboratoryId: laboratoryId || undefined, search: search || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, archived: status === 'ALL' ? undefined : status === 'ARCHIVED', sort, filters: dynamicFilters }); downloadBlob(result); } catch (error) { const parsed = parseJournalApiError(error); if (kind === 'template' && parsed.status === 404) setTemplateSupported(false); toast.error(parsed.message); } finally { setDownloadBusy(undefined); } };

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-black text-slate-950">Журналы</h1><p className="text-sm text-slate-500">Лабораторные записи по актуальной backend-схеме.</p></div><div className="flex flex-wrap gap-2">{canExportJournal(user) && <Button type="button" variant="secondary" disabled={!laboratoryId || Boolean(downloadBusy)} onClick={() => runDownload('excel')}><Download className="h-4 w-4" /> {downloadBusy === 'excel' ? 'Формирование...' : 'Скачать Excel'}</Button>}{templateSupported && canExportJournal(user) && <Button type="button" variant="secondary" disabled={Boolean(downloadBusy)} onClick={() => runDownload('template')}><FileDown className="h-4 w-4" /> Скачать шаблон</Button>}{canCreateJournalEntry(user, laboratoryId) && definition && <Button type="button" onClick={() => { setEditingId(undefined); setEditorOpen(true); }}><Plus className="h-4 w-4" /> Добавить запись</Button>}</div></header>
    {typesQuery.isLoading && <div className="rounded-xl border bg-white p-5 text-sm text-slate-600">Загрузка структуры журнала</div>}
    {typesQuery.data?.fallback && <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Endpoint схем временно недоступен. Используется совместимая fallback-схема версии 2.</div>}
    {typesQuery.error && <div className="flex items-center justify-between rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-800"><span>{parseJournalApiError(typesQuery.error).message === 'Схема журнала настроена некорректно' ? 'Схема журнала настроена некорректно' : 'Не удалось загрузить структуру журналов'}</span><Button type="button" variant="secondary" onClick={() => typesQuery.refetch()}>Повторить</Button></div>}
    <section className="grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1 text-sm font-semibold"><span>Вид журнала</span><select aria-label="Вид журнала" value={journalType} onChange={(event) => { const type = event.target.value as LabJournalType; const next = new URLSearchParams({ type, page: '0', size: String(size), archived: 'ACTIVE' }); if (laboratoryId) next.set('laboratoryId', String(laboratoryId)); setParams(next); }} className={inputClass}>{(definitions.length ? definitions : JOURNAL_TYPES).map((item) => <option key={item.code} value={item.code}>{item.title}</option>)}</select></label>
      <label className="space-y-1 text-sm font-semibold"><span>Лаборатория</span><select aria-label="Лаборатория" value={laboratoryId || ''} onChange={(event) => { const id = Number(event.target.value || 0); const next = new URLSearchParams(params); Array.from(next.keys()).filter((key) => key.startsWith('f_') || key === 'employeeId' || key === 'deviceId').forEach((key) => next.delete(key)); if (id) next.set('laboratoryId', String(id)); else next.delete('laboratoryId'); next.set('page', '0'); setParams(next, { replace: true }); }} disabled={user?.role === 'LABORATORY' && (labsQuery.data?.length || 0) <= 1} className={inputClass}><option value="">Выберите лабораторию</option>{labsQuery.data?.map((lab) => <option key={lab.id} value={lab.id}>{lab.name}{lab.defaultLaboratory ? ' · по умолчанию' : ''}</option>)}</select></label>
      <label className="space-y-1 text-sm font-semibold"><span>Поиск</span><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} className={inputClass} /></label>
      <label className="space-y-1 text-sm font-semibold"><span>Статус</span><select value={status} onChange={(event) => updateUrl({ archived: event.target.value, page: 0 })} className={inputClass}><option value="ACTIVE">Активные</option><option value="ARCHIVED">Архивные</option><option value="ALL">Все</option></select></label>
      <label className="space-y-1 text-sm font-semibold"><span>Дата от</span><input type="date" value={dateFrom} onChange={(event) => updateUrl({ dateFrom: event.target.value || undefined, page: 0 })} className={inputClass} /></label>
      <label className="space-y-1 text-sm font-semibold"><span>Дата до</span><input type="date" value={dateTo} onChange={(event) => updateUrl({ dateTo: event.target.value || undefined, page: 0 })} className={inputClass} /></label>
      {(extraFilters[journalType] || []).map((filter) => <label key={filter.key} className="space-y-1 text-sm font-semibold"><span>{filter.label}</span><input value={params.get(`f_${filter.key}`) || ''} onChange={(event) => updateUrl({ [`f_${filter.key}`]: event.target.value || undefined, page: 0 })} className={inputClass} /></label>)}
      <Button type="button" variant="secondary" onClick={() => { setSearchDraft(''); setParams(new URLSearchParams({ type: journalType, page: '0', size: String(size), archived: 'ACTIVE', ...(laboratoryId ? { laboratoryId: String(laboratoryId) } : {}) })); }}><RotateCcw className="h-4 w-4" /> Сбросить фильтры</Button>
    </section>
    {!laboratoryId && <div className="rounded-xl bg-sky-50 p-4 text-sm font-semibold text-sky-900">Выберите лабораторию, чтобы открыть журнал.</div>}
    {dateFrom && dateTo && dateFrom > dateTo && <div className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Дата начала периода не может быть позже даты окончания.</div>}
    {entriesQuery.error && <div className="flex items-center justify-between rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-800"><span>Не удалось загрузить журнал: {parseJournalApiError(entriesQuery.error).message}</span><Button type="button" variant="secondary" onClick={() => entriesQuery.refetch()}><RefreshCw className="h-4 w-4" /> Повторить</Button></div>}
    {definition && laboratoryId && <section className="overflow-hidden rounded-xl border bg-white"><div className="overflow-x-auto"><table className="min-w-max w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">№</th>{definition.columns.map((column) => <th key={column.key} className="p-3" style={{ width: column.width }}>{column.title}</th>)}<th className="p-3">Дата создания</th><th className="p-3">Автор</th><th className="p-3">Статус</th><th className="p-3">Действия</th></tr></thead><tbody>{entriesQuery.isLoading ? Array.from({ length: 5 }).map((_, index) => <tr key={index}>{Array.from({ length: definition.columns.length + 5 }).map((__, cell) => <td key={cell} className="p-3"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>)}</tr>) : entries.map((entry, index) => <tr key={entry.id} className="border-t align-top"><td className="p-3 font-bold">{page * size + index + 1}</td>{definition.columns.map((column) => <td key={column.key} className="max-w-[260px] p-3"><span title={formatJournalValue(column, entry.values[column.key])} className="line-clamp-3 whitespace-pre-wrap break-words">{formatJournalValue(column, entry.values[column.key])}</span></td>)}<td className="p-3">{entry.createdAt ? new Date(entry.createdAt).toLocaleString('ru-RU') : '—'}</td><td className="p-3">{entry.createdByName || '—'}</td><td className="p-3">{entry.archived ? 'Архивная' : entry.automatic ? 'Автоматическая' : 'Активная'}</td><td className="p-3"><div className="flex gap-2">{canEditJournalEntry(user, entry) && <Button type="button" variant="secondary" aria-label={`Изменить запись ${entry.id}`} onClick={() => { setEditingId(entry.id); setEditorOpen(true); }}><Edit3 className="h-4 w-4" /></Button>}{canArchiveJournalEntry(user, entry) && <Button type="button" variant="secondary" onClick={() => setConfirmEntry(entry)}><Archive className="h-4 w-4" /> Архивировать</Button>}{canRestoreJournalEntry(user, entry) && <Button type="button" onClick={() => setConfirmEntry(entry)}>Восстановить</Button>}</div></td></tr>)}</tbody></table></div>{!entriesQuery.isLoading && !entries.length && <div className="p-10 text-center text-sm text-slate-600"><p>{hasFilters ? 'По заданным параметрам записи не найдены' : 'В этом журнале пока нет записей'}</p>{!hasFilters && canCreateJournalEntry(user, laboratoryId) && <Button type="button" className="mt-3" onClick={() => setEditorOpen(true)}>Добавить первую запись</Button>}</div>}</section>}
    {entriesQuery.data && <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 text-sm"><span className="mr-auto">Показано {entries.length ? page * size + 1 : 0}–{page * size + entries.length} из {entriesQuery.data.totalElements}</span><select aria-label="Записей на странице" value={size} onChange={(event) => updateUrl({ size: event.target.value, page: 0 })} className="rounded-lg border p-2">{pageSizes.map((value) => <option key={value}>{value}</option>)}</select><Button type="button" variant="secondary" disabled={entriesQuery.data.first} onClick={() => updateUrl({ page: Math.max(0, page - 1) })}>Назад</Button><Button type="button" variant="secondary" disabled={entriesQuery.data.last} onClick={() => updateUrl({ page: Math.min(Math.max(0, entriesQuery.data.totalPages - 1), page + 1) })}>Далее</Button></div>}
    <Modal open={editorOpen} onClose={() => { if (!saving && (!formDirty || window.confirm('Есть несохранённые изменения. Закрыть форму?'))) { setFormDirty(false); setEditorOpen(false); setEditingId(undefined); } }} title={editingId ? 'Изменить запись' : 'Добавить запись'} size="xl" loading={saving}>{definition && (!editingId || entryQuery.data) ? <EntryForm definition={definition} laboratoryId={entryQuery.data?.laboratoryId || laboratoryId} entry={entryQuery.data} saving={saving} onDirtyChange={setFormDirty} onRefresh={async () => { await entryQuery.refetch(); }} onClose={() => { setFormDirty(false); setEditorOpen(false); setEditingId(undefined); }} onSaved={(saved) => { void saveCompleted(saved); }} /> : <p>Загрузка записи</p>}</Modal>
    <Modal open={Boolean(confirmEntry)} onClose={() => { if (!mutationBusy) setConfirmEntry(undefined); }} title={confirmEntry?.archived ? 'Восстановить запись журнала?' : 'Архивировать запись журнала?'}><p className="text-sm text-slate-600">{confirmEntry?.archived ? 'Запись снова появится в активном журнале.' : 'Запись будет скрыта из активного журнала, но сохранится в истории.'}</p><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" disabled={mutationBusy} onClick={() => setConfirmEntry(undefined)}>Отмена</Button><Button type="button" disabled={mutationBusy} onClick={archiveOrRestore}>{mutationBusy ? 'Выполнение...' : 'Подтвердить'}</Button></div></Modal>
  </div>;
};

export default LabJournalsPage;
