import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Download, Edit3, FileDown, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import {
  createLabJournalEntry,
  deleteLabJournalEntry,
  exportLabJournalExcel,
  getLabJournalEntries,
  getLabJournalTypes,
  updateLabJournalEntry,
} from '../services/labJournalService';
import {
  JOURNAL_TYPES,
  JournalType,
  type JournalColumn,
  type JournalTypeDefinition,
  type LabJournalEntry,
  type LabJournalEntryData,
  type LabJournalPage,
} from '../types/labJournal';

const PAGE_SIZE = 50;
const MIN_SEARCH_LENGTH = 3;
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';
const panelClass = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';

const today = () => new Date().toISOString().slice(0, 10);

const emptyPage: LabJournalPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  number: 0,
  size: PAGE_SIZE,
};

const dateColumnKeys = new Set(['registrationDate', 'date', 'protocolRegistrationDate', 'protocolIssueDate', 'preparationDate']);

const formatValue = (value: unknown, column: JournalColumn) => {
  if (value === undefined || value === null || value === '') return '—';
  if (column.type !== 'date') return String(value);
  const text = String(value).slice(0, 10);
  const [year, month, day] = text.split('-');
  return year && month && day ? `${day}.${month}.${year}` : String(value);
};

const valueForColumn = (entry: LabJournalEntry, column: JournalColumn) =>
  column.key === 'rowNumber' ? entry.rowNumber ?? entry.data.rowNumber : entry.data[column.key];

const firstDateValue = (columns: JournalColumn[], data: LabJournalEntryData) => {
  const dateColumn = columns.find((column) => column.type === 'date' && column.key !== 'rowNumber');
  return dateColumn ? String(data[dateColumn.key] || '') : '';
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

type JournalTableProps = {
  columns: JournalColumn[];
  rows: LabJournalEntry[];
  loading: boolean;
  onEdit: (entry: LabJournalEntry) => void;
  onDelete: (entry: LabJournalEntry) => void;
};

const JournalTable = ({ columns, rows, loading, onEdit, onDelete }: JournalTableProps) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-3 align-top">{column.title}</th>
            ))}
            <th className="px-3 py-3 text-right align-top">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? Array.from({ length: 5 }).map((_, rowIndex) => (
            <tr key={rowIndex} className="animate-pulse">
              {Array.from({ length: columns.length + 1 }).map((__, cellIndex) => (
                <td key={cellIndex} className="px-3 py-4"><div className="h-4 rounded bg-slate-100" /></td>
              ))}
            </tr>
          )) : rows.map((entry) => (
            <tr key={entry.id} className="align-top hover:bg-slate-50">
              {columns.map((column) => (
                <td key={column.key} className="max-w-[260px] px-3 py-3 text-slate-700">
                  <span className={column.key === 'rowNumber' ? 'font-bold text-slate-950' : 'whitespace-pre-wrap break-words'}>
                    {formatValue(valueForColumn(entry, column), column)}
                  </span>
                </td>
              ))}
              <td className="px-3 py-3">
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" className="px-3 py-2" onClick={() => onEdit(entry)}>
                    <Edit3 className="h-4 w-4" /> Изменить
                  </Button>
                  <Button type="button" variant="ghost" className="px-3 py-2 text-rose-700 hover:bg-rose-50" onClick={() => onDelete(entry)}>
                    <Trash2 className="h-4 w-4" /> Удалить
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {!loading && rows.length === 0 && (
      <div className="px-6 py-10 text-center text-sm font-semibold text-slate-500">
        Записи не найдены.
      </div>
    )}
  </div>
);

type EntryModalProps = {
  open: boolean;
  definition: JournalTypeDefinition;
  entry: LabJournalEntry | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: LabJournalEntryData, entryDate: string) => Promise<void>;
};

const EntryModal = ({ open, definition, entry, saving, onClose, onSubmit }: EntryModalProps) => {
  const fields = definition.columns.filter((column) => column.key !== 'rowNumber');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = fields.reduce<LabJournalEntryData>((acc, column) => {
      if (column.key === 'balance' && !form.get(column.key)) return acc;
      const value = String(form.get(column.key) || '').trim();
      if (!value) return acc;
      acc[column.key] = column.type === 'number' ? Number(value) : value;
      return acc;
    }, entry?.rowNumber ? { rowNumber: entry.rowNumber } : {});
    const entryDate = firstDateValue(definition.columns, data) || entry?.entryDate || today();
    await onSubmit(data, entryDate);
  };

  return (
    <Modal open={open} onClose={onClose} title={entry ? 'Изменить запись' : 'Добавить запись'} size="xl" loading={saving}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        {fields.map((column) => {
          const value = entry?.data[column.key] ?? '';
          const isAutoBalance = column.key === 'balance';
          return (
            <label key={column.key} className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>{column.title}</span>
              <input
                name={column.key}
                type={column.type === 'date' || dateColumnKeys.has(column.key) ? 'date' : column.type === 'number' ? 'number' : 'text'}
                step={column.type === 'number' ? 'any' : undefined}
                defaultValue={String(value)}
                readOnly={isAutoBalance}
                placeholder={isAutoBalance ? 'Рассчитывается автоматически' : undefined}
                className={`${inputClass} ${isAutoBalance ? 'bg-slate-100 text-slate-500' : ''}`}
              />
            </label>
          );
        })}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 md:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Отмена</Button>
          <Button type="submit" disabled={saving}>Сохранить</Button>
        </div>
      </form>
    </Modal>
  );
};

const LabJournalsPage = () => {
  const toast = useToast();
  const [types, setTypes] = useState<JournalTypeDefinition[]>(JOURNAL_TYPES);
  const [selectedJournalType, setSelectedJournalType] = useState<JournalType | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [entriesPage, setEntriesPage] = useState<LabJournalPage>(emptyPage);
  const [loading, setLoading] = useState(false);
  const [typesLoading, setTypesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<LabJournalEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const selectedDefinition = useMemo(
    () => types.find((item) => item.code === selectedJournalType),
    [selectedJournalType, types],
  );
  const searchTrimmed = debouncedSearch.trim();
  const searchReady = searchTrimmed.length === 0 || searchTrimmed.length >= MIN_SEARCH_LENGTH;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchDraft), 500);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    getLabJournalTypes()
      .then(setTypes)
      .catch((loadError) => {
        toast.warning('Не удалось загрузить список журналов с сервера', loadError instanceof Error ? loadError.message : undefined);
        setTypes(JOURNAL_TYPES);
      })
      .finally(() => setTypesLoading(false));
  }, [toast]);

  const loadEntries = async () => {
    if (!selectedJournalType || !searchReady) return;
    setLoading(true);
    setError('');
    try {
      setEntriesPage(await getLabJournalEntries({
        journalType: selectedJournalType,
        page,
        size: PAGE_SIZE,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: searchTrimmed || undefined,
      }));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Не удалось загрузить записи журнала.';
      setError(message);
      toast.error('Не удалось загрузить записи журнала', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedJournalType) {
      setEntriesPage(emptyPage);
      return;
    }
    if (!searchReady) return;
    loadEntries();
  }, [selectedJournalType, page, dateFrom, dateTo, searchReady, searchTrimmed]);

  const resetPage = () => setPage(0);

  const openCreate = () => {
    if (!selectedDefinition) {
      toast.warning('Сначала выберите журнал');
      return;
    }
    setEditing(null);
    setModalOpen(true);
  };

  const submitEntry = async (data: LabJournalEntryData, entryDate: string) => {
    if (!selectedJournalType) return;
    setSaving(true);
    try {
      if (editing) {
        await updateLabJournalEntry(editing.id, { journalType: selectedJournalType, entryDate, data });
        toast.success('Запись обновлена');
      } else {
        await createLabJournalEntry({ journalType: selectedJournalType, entryDate, data });
        toast.success('Запись добавлена');
      }
      setModalOpen(false);
      setEditing(null);
      await loadEntries();
    } catch (saveError) {
      toast.error('Не удалось сохранить запись', saveError instanceof Error ? saveError.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (entry: LabJournalEntry) => {
    if (!window.confirm(`Удалить запись №${entry.rowNumber || entry.id}?`)) return;
    try {
      await deleteLabJournalEntry(entry.id);
      toast.success('Запись удалена');
      await loadEntries();
    } catch (deleteError) {
      toast.error('Не удалось удалить запись', deleteError instanceof Error ? deleteError.message : undefined);
    }
  };

  const downloadExcel = async (template = false) => {
    if (!selectedJournalType) {
      toast.warning('Сначала выберите журнал');
      return;
    }
    try {
      const { blob, fileName } = await exportLabJournalExcel({
        journalType: selectedJournalType,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        template,
      });
      downloadBlob(blob, fileName || `journal_${selectedJournalType}_${template ? 'template' : today()}.xlsx`);
    } catch (downloadError) {
      toast.error('Не удалось скачать Excel', downloadError instanceof Error ? downloadError.message : undefined);
    }
  };

  const totalPages = entriesPage.totalPages || 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 bg-white pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">Лаборатория</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Журналы лаборатории</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Выберите журнал, чтобы добавить записи, отфильтровать данные и скачать Excel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => downloadExcel(true)} disabled={!selectedJournalType}>
            <FileDown className="h-4 w-4" /> Скачать пустой шаблон Excel
          </Button>
          <Button type="button" variant="secondary" onClick={() => downloadExcel(false)} disabled={!selectedJournalType}>
            <Download className="h-4 w-4" /> Скачать Excel
          </Button>
          <Button type="button" onClick={openCreate} disabled={!selectedJournalType}>
            <Plus className="h-4 w-4" /> Добавить запись
          </Button>
        </div>
      </header>

      <section className={`${panelClass} grid gap-3 xl:grid-cols-[minmax(280px,1.5fr)_160px_160px_minmax(220px,1fr)_auto] xl:items-end`}>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Выберите журнал</span>
          <select
            value={selectedJournalType}
            onChange={(event) => {
              setSelectedJournalType(event.target.value as JournalType | '');
              setEntriesPage(emptyPage);
              setPage(0);
            }}
            className={inputClass}
            disabled={typesLoading}
          >
            <option value="">{typesLoading ? 'Загрузка...' : 'Выберите журнал'}</option>
            {types.map((item) => <option key={item.code} value={item.code}>{item.title}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Дата с</span>
          <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); resetPage(); }} className={inputClass} />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Дата по</span>
          <input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); resetPage(); }} className={inputClass} />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Поиск</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchDraft} onChange={(event) => { setSearchDraft(event.target.value); resetPage(); }} className={`${inputClass} pl-9`} placeholder="Минимум 3 символа" />
          </div>
        </label>
        <Button type="button" variant="secondary" onClick={loadEntries} disabled={!selectedJournalType || loading || !searchReady}>
          <RefreshCw className="h-4 w-4" /> Обновить
        </Button>
      </section>

      {!searchReady && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Для поиска введите минимум {MIN_SEARCH_LENGTH} символа.
        </div>
      )}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}

      {selectedDefinition ? (
        <>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">{selectedDefinition.title}</h2>
              <p className="mt-1 text-sm text-slate-500">Всего записей: {entriesPage.totalElements}</p>
            </div>
            <div className="text-sm font-semibold text-slate-500">Страница {totalPages ? page + 1 : 0} из {totalPages}</div>
          </div>
          <JournalTable
            columns={selectedDefinition.columns}
            rows={entriesPage.content}
            loading={loading}
            onEdit={(entry) => { setEditing(entry); setModalOpen(true); }}
            onDelete={removeEntry}
          />
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-500">Показывается до {PAGE_SIZE} записей на странице.</p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={page <= 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))}>Назад</Button>
              <Button type="button" variant="secondary" disabled={loading || page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>Вперед</Button>
            </div>
          </div>
          <EntryModal
            open={modalOpen}
            definition={selectedDefinition}
            entry={editing}
            saving={saving}
            onClose={() => { setModalOpen(false); setEditing(null); }}
            onSubmit={submitEntry}
          />
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-semibold text-slate-500">
          Выберите журнал, чтобы увидеть таблицу записей.
        </div>
      )}
    </div>
  );
};

export default LabJournalsPage;
