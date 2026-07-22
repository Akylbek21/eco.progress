import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { normalizeApiError } from '../../../services/apiHelpers';
import { getActiveLaboratories } from '../../../services/laboratorySettingsService';
import { LAB_JOURNAL_TYPES, JournalType, type JournalEntriesQuery, type LabJournalEntry, type LabJournalType } from '../../../types/labJournal';
import { downloadBlobResponse, downloadTemplate, exportJournal } from '../api/labJournalService';
import { JournalEntriesTable } from '../components/JournalEntriesTable';
import { JournalEntryDialog } from '../components/JournalEntryDialog';
import { JournalExportButton } from '../components/JournalExportButton';
import { JournalFilters, type JournalFilterValues } from '../components/JournalFilters';
import { JournalTypeSelector } from '../components/JournalTypeSelector';
import { useJournalEntries } from '../hooks/useJournalEntries';
import { useJournalEntryMutations } from '../hooks/useJournalEntryMutations';
import { useJournalTypes } from '../hooks/useJournalTypes';
import { canCreateLabJournalEntry, canDeleteLabJournalEntry, canEditLabJournalEntry, canExportLabJournals, canReadLabJournals } from '../utils/journalPermissions';
import { formatJournalDate } from '../utils/journalFormatters';

const pageSizes = [10, 25, 50, 100];
const supportedTypes = new Set<LabJournalType>(Object.values(JournalType));
type DialogState = { mode: 'create' | 'view' | 'edit'; entry?: LabJournalEntry } | null;

const LabJournalsPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const requestedType = params.get('journalType') || params.get('type');
  const journalType = supportedTypes.has(requestedType as LabJournalType) ? requestedType as LabJournalType : JournalType.SAMPLE_REGISTRATION;
  const page = Math.max(0, Number(params.get('page') || 0));
  const sizeValue = Number(params.get('size') || 25);
  const size = pageSizes.includes(sizeValue) ? sizeValue : 25;
  const sort = params.get('sort') || 'entryDate,desc';
  const filterValues: JournalFilterValues = {
    laboratoryId: Number(params.get('laboratoryId') || 0),
    dateFrom: params.get('dateFrom') || '',
    dateTo: params.get('dateTo') || '',
    executorName: params.get('executorName') || '',
    search: params.get('search') || '',
  };
  const [searchDraft, setSearchDraft] = useState(filterValues.search);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [formDirty, setFormDirty] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LabJournalEntry>();
  const [downloadBusy, setDownloadBusy] = useState<'template' | 'export' | ''>('');
  const { deleteMutation } = useJournalEntryMutations();

  const patchUrl = useCallback((patch: Record<string, string | number | undefined>) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      Object.entries(patch).forEach(([key, value]) => value === undefined || value === '' || value === 0 ? next.delete(key) : next.set(key, String(value)));
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => {
    if (!params.has('journalType')) patchUrl({ journalType, type: undefined, page, size, sort });
  }, [journalType, page, params, patchUrl, size, sort]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const value = searchDraft.trim();
      patchUrl({ search: value.length >= 2 ? value : undefined, page: 0 });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [searchDraft, patchUrl]);

  const typesQuery = useJournalTypes();
  const definitions = typesQuery.data?.content || [];
  const definition = definitions.find((item) => item.code === journalType);
  const laboratoriesQuery = useQuery({ queryKey: ['laboratories', 'lab-journal-options'], queryFn: ({ signal }) => getActiveLaboratories(signal), staleTime: 5 * 60_000 });
  useEffect(() => {
    const laboratories = laboratoriesQuery.data || [];
    if (!filterValues.laboratoryId && laboratories.length === 1) patchUrl({ laboratoryId: laboratories[0].id, page: 0 });
    if (user?.role === 'LABORATORY' && laboratories.length && !laboratories.some((item) => item.id === filterValues.laboratoryId)) patchUrl({ laboratoryId: laboratories[0].id, page: 0 });
  }, [filterValues.laboratoryId, laboratoriesQuery.data, patchUrl, user?.role]);

  const validPeriod = !filterValues.dateFrom || !filterValues.dateTo || filterValues.dateFrom <= filterValues.dateTo;
  const query = useMemo<JournalEntriesQuery>(() => ({
    journalType,
    laboratoryId: filterValues.laboratoryId || undefined,
    dateFrom: filterValues.dateFrom || undefined,
    dateTo: filterValues.dateTo || undefined,
    executorName: filterValues.executorName.trim() || undefined,
    search: filterValues.search.length >= 2 ? filterValues.search : undefined,
    page, size, sort,
  }), [filterValues.dateFrom, filterValues.dateTo, filterValues.executorName, filterValues.laboratoryId, filterValues.search, journalType, page, size, sort]);
  const entriesQuery = useJournalEntries(query, Boolean(definition && filterValues.laboratoryId && validPeriod));
  const entries = entriesQuery.data?.content || [];
  const hasFilters = Boolean(filterValues.dateFrom || filterValues.dateTo || filterValues.executorName || filterValues.search);
  const typesError = typesQuery.error ? normalizeApiError(typesQuery.error) : null;
  const entriesError = entriesQuery.error ? normalizeApiError(entriesQuery.error) : null;

  if (!canReadLabJournals(user)) return <div className="rounded-xl bg-amber-50 p-5 font-semibold text-amber-900">У вас нет доступа к этому разделу.</div>;

  const closeDialog = () => { setDialog(null); setFormDirty(false); setFormBusy(false); };
  const switchContext = (patch: Record<string, string | number | undefined>, clearsDynamicFields = false) => {
    if (formBusy) return;
    if (formDirty && !window.confirm(clearsDynamicFields ? 'Есть несохранённые изменения. При смене вида журнала динамические поля будут очищены. Продолжить?' : 'Есть несохранённые изменения. Продолжить?')) return;
    closeDialog();
    patchUrl({ ...patch, page: 0 });
  };
  const runDownload = async (kind: 'template' | 'export') => {
    if (downloadBusy || !definition) return;
    setDownloadBusy(kind);
    try {
      const response = kind === 'template' ? await downloadTemplate(journalType) : await exportJournal({ journalType, laboratoryId: filterValues.laboratoryId || undefined, dateFrom: query.dateFrom, dateTo: query.dateTo, executorName: query.executorName, search: query.search, sort });
      downloadBlobResponse(response);
      toast.success(kind === 'template' ? 'Шаблон Excel скачан' : 'Экспорт Excel сформирован');
    } catch (error) { toast.error(normalizeApiError(error, 'Не удалось скачать Excel.').message); }
    finally { setDownloadBusy(''); }
  };
  const removeEntry = async () => {
    if (!deleteTarget || deleteMutation.isPending || !canDeleteLabJournalEntry(user, deleteTarget)) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      if (entries.length === 1 && page > 0) patchUrl({ page: page - 1 });
      toast.success('Запись журнала удалена');
      setDeleteTarget(undefined);
    } catch (error) { toast.error(normalizeApiError(error, 'Не удалось удалить запись журнала.').message); }
  };

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><h1 className="text-2xl font-black text-slate-950">Журналы лаборатории</h1><p className="text-sm text-slate-500">Регистрация и выгрузка лабораторных записей.</p></div><div className="flex flex-wrap gap-2">{canExportLabJournals(user) && <JournalExportButton disabled={!definition || !filterValues.laboratoryId} busy={downloadBusy} onTemplate={() => void runDownload('template')} onExport={() => void runDownload('export')} />}{canCreateLabJournalEntry(user) && definition && <Button type="button" disabled={!filterValues.laboratoryId} onClick={() => setDialog({ mode: 'create' })}><Plus className="h-4 w-4" /> Добавить запись</Button>}</div></header>
    {typesQuery.isLoading ? <div className="h-20 animate-pulse rounded-xl bg-slate-100" /> : definitions.length > 0 && <div className="rounded-xl border bg-white p-4"><JournalTypeSelector value={journalType} definitions={definitions} disabled={formBusy} onChange={(value) => switchContext({ journalType: value, type: undefined }, true)} />{import.meta.env.DEV && definition && <p className="mt-2 text-xs text-slate-500">Источник схемы: {definition.schemaSource === 'backend' ? 'backend' : 'локальная конфигурация'}</p>}</div>}
    {typesError && <div role="alert" className="flex items-center justify-between rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-800"><span>{typesError.status === 403 ? 'У вас нет доступа к этому разделу.' : typesError.message}</span><Button type="button" variant="secondary" onClick={() => typesQuery.refetch()}><RefreshCw className="h-4 w-4" /> Повторить</Button></div>}
    <JournalFilters values={{ ...filterValues, search: searchDraft }} laboratories={laboratoriesQuery.data || []} laboratoryLocked={user?.role === 'LABORATORY' && (laboratoriesQuery.data?.length || 0) <= 1} loading={laboratoriesQuery.isLoading} onChange={(patch) => { if ('search' in patch) { setSearchDraft(patch.search || ''); return; } if ('laboratoryId' in patch) switchContext({ laboratoryId: patch.laboratoryId }, false); else patchUrl({ ...patch, page: 0 }); }} onReset={() => { setSearchDraft(''); patchUrl({ dateFrom: undefined, dateTo: undefined, executorName: undefined, search: undefined, page: 0 }); }} />
    {!filterValues.laboratoryId && <div className="rounded-xl bg-sky-50 p-4 text-sm font-semibold text-sky-900">Выберите лабораторию, чтобы открыть журнал.</div>}
    {!validPeriod && <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Дата начала периода не может быть позже даты окончания.</div>}
    {entriesError && <div role="alert" className="flex items-center justify-between rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-800"><span>{entriesError.status === 403 ? 'У вас нет доступа к этому разделу.' : `Не удалось загрузить журнал. ${entriesError.message}`}</span><Button type="button" variant="secondary" onClick={() => entriesQuery.refetch()}><RefreshCw className="h-4 w-4" /> Повторить</Button></div>}
    {definition && filterValues.laboratoryId > 0 && !entriesError && <JournalEntriesTable entries={entries} page={page} size={size} loading={entriesQuery.isLoading} filtered={hasFilters} canCreate={canCreateLabJournalEntry(user)} canEdit={(entry) => canEditLabJournalEntry(user, entry)} canDelete={(entry) => canDeleteLabJournalEntry(user, entry)} onCreate={() => setDialog({ mode: 'create' })} onView={(entry) => setDialog({ mode: 'view', entry })} onEdit={(entry) => setDialog({ mode: 'edit', entry })} onDelete={setDeleteTarget} />}
    {entriesQuery.data && !entriesError && <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 text-sm"><span className="mr-auto">Показано {entries.length ? page * size + 1 : 0}–{page * size + entries.length} из {entriesQuery.data.totalElements}</span><select aria-label="Записей на странице" value={size} onChange={(event) => patchUrl({ size: Number(event.target.value), page: 0 })} className="rounded-lg border p-2">{pageSizes.map((value) => <option key={value} value={value}>{value}</option>)}</select><Button type="button" variant="secondary" disabled={page === 0} onClick={() => patchUrl({ page: page - 1 })}>Назад</Button><Button type="button" variant="secondary" disabled={entriesQuery.data.totalPages === 0 || page >= entriesQuery.data.totalPages - 1} onClick={() => patchUrl({ page: page + 1 })}>Далее</Button></div>}
    {dialog && definition && <JournalEntryDialog open definition={definition} laboratoryId={dialog.entry?.laboratoryId || filterValues.laboratoryId} entry={dialog.entry} mode={dialog.mode} dirty={formDirty} busy={formBusy} onDirtyChange={setFormDirty} onBusyChange={setFormBusy} onClose={closeDialog} onSaved={closeDialog} onSuccessMessage={(message) => toast.success(message)} />}
    <Modal open={Boolean(deleteTarget)} onClose={() => { if (!deleteMutation.isPending) setDeleteTarget(undefined); }} title="Удалить запись журнала?" loading={deleteMutation.isPending}><div className="space-y-2 text-sm text-slate-700"><p><strong>Журнал:</strong> {deleteTarget ? LAB_JOURNAL_TYPES[deleteTarget.journalType].label : '—'}</p><p><strong>Дата:</strong> {formatJournalDate(deleteTarget?.entryDate)}</p><p><strong>Исполнитель:</strong> {deleteTarget?.executorName || '—'}</p><p className="font-semibold text-rose-700">Действие нельзя отменить.</p></div><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" disabled={deleteMutation.isPending} onClick={() => setDeleteTarget(undefined)}>Отмена</Button><Button type="button" disabled={deleteMutation.isPending} onClick={() => void removeEntry()}>{deleteMutation.isPending ? 'Удаление...' : 'Удалить'}</Button></div></Modal>
  </div>;
};

export default LabJournalsPage;
