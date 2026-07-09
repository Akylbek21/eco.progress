import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Edit3, FileDown, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/modals/ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { getApiStatus } from '../services/apiHelpers';
import { getLaboratories } from '../services/laboratorySettingsService';
import {
  createEntry,
  deleteEntry,
  downloadExcel,
  downloadTemplate,
  getEntries,
  getJournalTypes,
  updateEntry,
} from '../services/labJournalService';
import {
  JOURNAL_TYPES,
  type JournalColumn,
  type JournalKind,
  type JournalType,
  type JournalTypeDefinition,
  type LabJournalEntry,
  type LabJournalEntryData,
  type LabJournalPage,
  type LabJournalValue,
} from '../types/labJournal';
import type { LaboratorySummary } from '../types/protocols';

const PAGE_SIZE = 50;
const MIN_SEARCH_LENGTH = 3;
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';
const panelClass = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm';

const emptyPage: LabJournalPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  number: 0,
  size: PAGE_SIZE,
};

const today = () => new Date().toISOString().slice(0, 10);

const text = (value: unknown) => value === undefined || value === null ? '' : String(value);
const firstText = (data: LabJournalEntryData, keys: string[]) => keys.map((key) => text(data[key]).trim()).find(Boolean) || '';
const isAdminOrHead = (role?: string) => role === 'ADMIN' || role === 'HEAD';

const formatDate = (value: unknown) => {
  const raw = text(value).slice(0, 10);
  const [year, month, day] = raw.split('-');
  return year && month && day ? `${day}.${month}.${year}` : raw || '—';
};

const formatDateTime = (value: unknown) => {
  const raw = text(value);
  if (!raw) return '—';
  const date = formatDate(raw);
  const time = raw.match(/T(\d{2}:\d{2})/)?.[1];
  return time ? `${date} ${time}` : date;
};

const kindFromDefinition = (definition?: JournalTypeDefinition): JournalKind => {
  if (!definition) return 'custom';
  if (definition.kind) return definition.kind;
  const value = `${definition.code} ${definition.title}`.toLowerCase();
  if (/solution|preparation|reagent_preparation|приготов/.test(value)) return 'solution';
  if (/chemical|reagent|reactive|веществ|реактив|хим/.test(value)) return 'chemical';
  if (/environment|condition|humidity|temperature|услов|сред|температур|влаж/.test(value)) return 'environment';
  if (/sample|sampling|проб/.test(value)) return 'sample';
  if (/result|test|protocol|испыт|результ|протокол/.test(value)) return 'results';
  return 'custom';
};

const fieldsForDefinition = (definition: JournalTypeDefinition): JournalColumn[] => {
  const fallback = JOURNAL_TYPES.find((item) => item.kind === kindFromDefinition(definition));
  if (fallback) return fallback.columns;
  return definition.columns.length ? definition.columns.filter((column) => column.key !== 'rowNumber') : [
    { key: 'date', title: 'Дата', type: 'date' },
    { key: 'note', title: 'Примечание', type: 'textarea' },
  ];
};

const primaryDateForEntry = (entry: LabJournalEntry) =>
  entry.entryDate
  || firstText(entry.data, ['date', 'preparedDate', 'samplingDate', 'registrationDate', 'protocolDate'])
  || entry.createdAt;

const renderEntrySummary = (entry: LabJournalEntry, definition?: JournalTypeDefinition) => {
  const data = entry.data;
  const unit = firstText(data, ['unit']);
  const valueWithUnit = (value: string) => value ? `${value}${unit ? ` ${unit}` : ''}` : '0';

  switch (kindFromDefinition(definition)) {
    case 'chemical': {
      const name = firstText(data, ['substanceName', 'reagentName', 'name']) || 'Вещество';
      const income = firstText(data, ['income', 'incomingQuantity']);
      const expense = firstText(data, ['expense', 'outgoingQuantity']);
      const balance = firstText(data, ['balance']);
      return `${name} — приход: ${valueWithUnit(income)}, расход: ${valueWithUnit(expense)}${balance ? `, остаток: ${valueWithUnit(balance)}` : ''}`;
    }
    case 'environment': {
      const room = firstText(data, ['room', 'cabinet', 'place']) || 'Помещение';
      const temperature = firstText(data, ['temperature']);
      const humidity = firstText(data, ['humidity', 'relativeHumidity']);
      const pressure = firstText(data, ['pressure']);
      return [room, temperature && `${temperature}°C`, humidity && `влажность ${humidity}%`, pressure && `давление ${pressure}`].filter(Boolean).join(' — ');
    }
    case 'sample': {
      const number = firstText(data, ['sampleNumber', 'number']) || entry.rowNumber || '—';
      const name = firstText(data, ['sampleName', 'name']) || 'проба';
      const place = firstText(data, ['samplingPlace', 'place']);
      return `Проба №${number} — ${name}${place ? `, место отбора: ${place}` : ''}`;
    }
    case 'solution': {
      const name = firstText(data, ['solutionName', 'preparedReagentName', 'reagentName']) || 'Раствор';
      const concentration = firstText(data, ['concentration']);
      const preparedBy = firstText(data, ['preparedBy']);
      return [name, concentration, preparedBy && `приготовил: ${preparedBy}`].filter(Boolean).join(' — ');
    }
    case 'results': {
      const protocolNumber = firstText(data, ['protocolNumber']);
      const sampleNumber = firstText(data, ['sampleNumber']);
      const indicator = firstText(data, ['indicatorName', 'indicator']);
      const result = firstText(data, ['result']);
      const resultUnit = firstText(data, ['unit']);
      return [
        protocolNumber && `Протокол №${protocolNumber}`,
        sampleNumber && `проба №${sampleNumber}`,
        indicator,
        result && `результат: ${result}${resultUnit ? ` ${resultUnit}` : ''}`,
      ].filter(Boolean).join(' — ') || 'Результат испытаний';
    }
    default: {
      const visible = Object.entries(data)
        .filter(([key, value]) => key !== 'rowNumber' && value !== undefined && value !== null && value !== '')
        .slice(0, 3)
        .map(([, value]) => text(value));
      return visible.join(' — ') || 'Запись журнала';
    }
  }
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

const toFormValue = (value: LabJournalValue | undefined) => value === undefined || value === null ? '' : String(value);

type EntryModalProps = {
  open: boolean;
  definition: JournalTypeDefinition;
  entry: LabJournalEntry | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: LabJournalEntryData, entryDate: string) => Promise<void>;
};

const EntryModal = ({ open, definition, entry, saving, onClose, onSubmit }: EntryModalProps) => {
  const [formError, setFormError] = useState('');
  const fields = useMemo(() => fieldsForDefinition(definition), [definition]);
  const kind = kindFromDefinition(definition);

  useEffect(() => {
    if (open) setFormError('');
  }, [open, entry, definition.code]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const form = new FormData(event.currentTarget);
    const data = fields.reduce<LabJournalEntryData>((acc, field) => {
      if (field.readOnly) return acc;
      const raw = text(form.get(field.key)).trim();
      if (!raw) return acc;
      acc[field.key] = field.type === 'number' ? Number(raw) : raw;
      return acc;
    }, entry?.rowNumber ? { rowNumber: entry.rowNumber } : {});

    const requiredError = fields.find((field) => field.required && !text(data[field.key]).trim());
    if (requiredError) {
      setFormError(`Заполните поле «${requiredError.title}».`);
      return;
    }

    if (kind === 'environment') {
      if (!data.date) {
        setFormError('Дата обязательна.');
        return;
      }
      const temperature = data.temperature;
      const humidity = data.humidity;
      const pressure = data.pressure;
      if (temperature !== undefined && !Number.isFinite(Number(temperature))) {
        setFormError('Температура должна быть числом.');
        return;
      }
      if (humidity !== undefined && (!Number.isFinite(Number(humidity)) || Number(humidity) < 0 || Number(humidity) > 100)) {
        setFormError('Влажность должна быть числом от 0 до 100.');
        return;
      }
      if (pressure !== undefined && !Number.isFinite(Number(pressure))) {
        setFormError('Давление должно быть числом.');
        return;
      }
    }

    if (kind === 'solution') {
      if (!data.solutionName) {
        setFormError('Название раствора обязательное.');
        return;
      }
      if (!data.preparedDate) {
        setFormError('Дата приготовления обязательна.');
        return;
      }
      if (data.expiryDate && text(data.expiryDate) < text(data.preparedDate)) {
        setFormError('Срок годности не должен быть раньше даты приготовления.');
        return;
      }
    }

    const entryDate = firstText(data, ['date', 'preparedDate', 'samplingDate']) || entry?.entryDate || today();
    await onSubmit(data, entryDate);
  };

  return (
    <Modal open={open} onClose={onClose} title={entry ? 'Редактировать запись' : 'Добавить запись'} size="xl" loading={saving}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700 md:col-span-2">
          {definition.title}
        </div>
        {formError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800 md:col-span-2">
            {formError}
          </div>
        )}
        {fields.map((field) => {
          const value = toFormValue(entry?.data[field.key]);
          const isTextarea = field.type === 'textarea';
          const commonProps = {
            name: field.key,
            defaultValue: value,
            readOnly: field.readOnly,
            required: field.required,
            className: `${inputClass} ${field.readOnly ? 'bg-slate-100 text-slate-500' : ''}`,
            placeholder: field.readOnly ? 'Рассчитывается backend' : undefined,
          };
          return (
            <label key={field.key} className={`space-y-1.5 text-sm font-semibold text-slate-700 ${isTextarea ? 'md:col-span-2' : ''}`}>
              <span>{field.title}{field.required ? ' *' : ''}</span>
              {isTextarea ? (
                <textarea {...commonProps} rows={3} />
              ) : (
                <input
                  {...commonProps}
                  type={field.type === 'date' || field.type === 'time' ? field.type : field.type === 'number' ? 'number' : 'text'}
                  step={field.type === 'number' ? 'any' : undefined}
                  min={field.key === 'humidity' ? 0 : undefined}
                  max={field.key === 'humidity' ? 100 : undefined}
                />
              )}
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
  const { user } = useAuth();
  const canFilterLaboratory = isAdminOrHead(user?.role);

  const [types, setTypes] = useState<JournalTypeDefinition[]>(JOURNAL_TYPES);
  const [selectedJournalType, setSelectedJournalType] = useState<JournalType>('');
  const [laboratories, setLaboratories] = useState<LaboratorySummary[]>([]);
  const [laboratoryId, setLaboratoryId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [entriesPage, setEntriesPage] = useState<LabJournalPage>(emptyPage);
  const [loading, setLoading] = useState(false);
  const [laboratoriesLoading, setLaboratoriesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState<'excel' | 'template' | ''>('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<LabJournalEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LabJournalEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const {
    data: backendTypes,
    error: typesError,
    isError: typesFailed,
    isLoading: typesLoading,
  } = useQuery({
    queryKey: ['lab-journal-types'],
    queryFn: ({ signal }) => getJournalTypes(signal),
    retry: false,
  });

  const selectedDefinition = useMemo(
    () => types.find((item) => item.code === selectedJournalType),
    [selectedJournalType, types],
  );

  const typeTitleByCode = useMemo(
    () => new Map(types.map((item) => [item.code, item.title])),
    [types],
  );

  const laboratoryNameById = useMemo(
    () => new Map(laboratories.map((item) => [text(item.id), item.name])),
    [laboratories],
  );

  const searchTrimmed = debouncedSearch.trim();
  const searchReady = searchTrimmed.length === 0 || searchTrimmed.length >= MIN_SEARCH_LENGTH;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchDraft), 450);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    if (backendTypes) setTypes(backendTypes.length ? backendTypes : JOURNAL_TYPES);
  }, [backendTypes]);

  useEffect(() => {
    if (!typesFailed) return;
    const status = getApiStatus(typesError);
    const message = status === 404
      ? 'Endpoint /api/lab-journals/types пока недоступен, используем fallback types.'
      : typesError instanceof Error ? typesError.message : undefined;
    toast.warning('Не удалось загрузить типы журналов', message);
    setTypes(JOURNAL_TYPES);
  }, [typesFailed, typesError, toast]);

  useEffect(() => {
    if (!canFilterLaboratory) return;
    setLaboratoriesLoading(true);
    getLaboratories()
      .then((items) => setLaboratories(items.filter((item) => item.active)))
      .catch((loadError) => toast.warning('Не удалось загрузить список лабораторий', loadError instanceof Error ? loadError.message : undefined))
      .finally(() => setLaboratoriesLoading(false));
  }, [canFilterLaboratory, toast]);

  const loadEntries = async () => {
    if (!selectedJournalType || !searchReady) return;
    setLoading(true);
    setError('');
    try {
      setEntriesPage(await getEntries({
        journalType: selectedJournalType,
        laboratoryId: laboratoryId || undefined,
        page,
        size: PAGE_SIZE,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: searchTrimmed || undefined,
      }));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Не удалось загрузить журналы';
      setError('Не удалось загрузить журналы');
      toast.error('Не удалось загрузить журналы', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedJournalType) {
      setEntriesPage(emptyPage);
      return;
    }
    if (searchReady) loadEntries();
  }, [selectedJournalType, laboratoryId, page, dateFrom, dateTo, searchReady, searchTrimmed]);

  const resetPage = () => setPage(0);

  const openCreate = () => {
    if (!selectedDefinition) {
      toast.warning('Сначала выберите тип журнала');
      return;
    }
    setEditing(null);
    setModalOpen(true);
  };

  const submitEntry = async (data: LabJournalEntryData, entryDate: string) => {
    if (!selectedJournalType) return;
    setSaving(true);
    try {
      const payload = {
        journalType: selectedJournalType,
        entryDate,
        data,
        laboratoryId: laboratoryId || undefined,
      };
      if (editing) {
        await updateEntry(editing.id, payload);
        toast.success('Запись обновлена');
      } else {
        await createEntry(payload);
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEntry(deleteTarget.id);
      setDeleteTarget(null);
      toast.success('Запись удалена');
      await loadEntries();
    } catch (deleteError) {
      toast.error('Не удалось удалить запись', deleteError instanceof Error ? deleteError.message : undefined);
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (template: boolean) => {
    if (!selectedJournalType) {
      toast.warning('Сначала выберите тип журнала');
      return;
    }
    const state = template ? 'template' : 'excel';
    setDownloading(state);
    try {
      const params = {
        journalType: selectedJournalType,
        laboratoryId: laboratoryId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
      const { blob, fileName } = template ? await downloadTemplate(params) : await downloadExcel(params);
      downloadBlob(blob, fileName);
    } catch (downloadError) {
      toast.error('Не удалось скачать Excel', downloadError instanceof Error ? downloadError.message : undefined);
    } finally {
      setDownloading('');
    }
  };

  const totalPages = entriesPage.totalPages || 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 bg-white pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">Лаборатория</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Журналы лаборатории</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Выберите тип журнала, ведите записи и скачивайте Excel по текущим фильтрам.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => handleDownload(false)} disabled={!selectedJournalType || downloading !== ''}>
            <Download className="h-4 w-4" /> {downloading === 'excel' ? 'Скачивание...' : 'Скачать Excel'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => handleDownload(true)} disabled={!selectedJournalType || downloading !== ''}>
            <FileDown className="h-4 w-4" /> {downloading === 'template' ? 'Скачивание...' : 'Скачать пустой шаблон Excel'}
          </Button>
          <Button type="button" onClick={openCreate} disabled={!selectedJournalType}>
            <Plus className="h-4 w-4" /> Добавить запись
          </Button>
        </div>
      </header>

      <section className={`${panelClass} grid gap-3 xl:grid-cols-[minmax(260px,1.4fr)_minmax(180px,1fr)_150px_150px_minmax(210px,1fr)_auto] xl:items-end`}>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Тип журнала</span>
          <select
            value={selectedJournalType}
            onChange={(event) => {
              setSelectedJournalType(event.target.value);
              setEntriesPage(emptyPage);
              setPage(0);
            }}
            className={inputClass}
            disabled={typesLoading}
          >
            <option value="">{typesLoading ? 'Загрузка типов...' : 'Выберите тип журнала'}</option>
            {types.map((item) => <option key={item.code} value={item.code}>{item.title}</option>)}
          </select>
        </label>

        {canFilterLaboratory ? (
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>Лаборатория</span>
            <select
              value={laboratoryId}
              onChange={(event) => { setLaboratoryId(event.target.value); resetPage(); }}
              className={inputClass}
              disabled={laboratoriesLoading}
            >
              <option value="">{laboratoriesLoading ? 'Загрузка...' : 'Все лаборатории'}</option>
              {laboratories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isDefault ? ' · по умолчанию' : ''}</option>)}
            </select>
          </label>
        ) : <div className="hidden xl:block" />}

        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Дата от</span>
          <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); resetPage(); }} className={inputClass} />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Дата до</span>
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
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Обновить
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

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-3">№</th>
                    <th className="px-3 py-3">Дата</th>
                    <th className="px-3 py-3">Тип журнала</th>
                    <th className="px-3 py-3">Основные данные записи</th>
                    <th className="px-3 py-3">Лаборатория</th>
                    <th className="px-3 py-3">Создал</th>
                    <th className="px-3 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? Array.from({ length: 5 }).map((_, rowIndex) => (
                    <tr key={rowIndex} className="animate-pulse">
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-4"><div className="h-4 rounded bg-slate-100" /></td>
                      ))}
                    </tr>
                  )) : entriesPage.content.map((entry, index) => {
                    const definition = types.find((item) => item.code === entry.journalType) || selectedDefinition;
                    const rowNumber = entry.rowNumber || page * PAGE_SIZE + index + 1;
                    const laboratoryName = entry.laboratoryName || laboratoryNameById.get(text(entry.laboratoryId)) || '—';
                    return (
                      <tr key={entry.id} className="align-top hover:bg-slate-50">
                        <td className="px-3 py-3 font-bold text-slate-950">{rowNumber}</td>
                        <td className="px-3 py-3 text-slate-700">{formatDate(primaryDateForEntry(entry))}</td>
                        <td className="max-w-[220px] px-3 py-3 font-semibold text-slate-800">{typeTitleByCode.get(entry.journalType) || definition.title || entry.journalType}</td>
                        <td className="max-w-[360px] px-3 py-3 text-slate-700">
                          <span className="whitespace-pre-wrap break-words">{renderEntrySummary(entry, definition)}</span>
                        </td>
                        <td className="max-w-[220px] px-3 py-3 text-slate-700">{laboratoryName}</td>
                        <td className="px-3 py-3 text-slate-700">
                          <div>{entry.createdByName || '—'}</div>
                          {entry.createdAt && <div className="mt-1 text-xs text-slate-400">{formatDateTime(entry.createdAt)}</div>}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="secondary" className="px-3 py-2" onClick={() => { setEditing(entry); setModalOpen(true); }}>
                              <Edit3 className="h-4 w-4" /> Изменить
                            </Button>
                            <Button type="button" variant="ghost" className="px-3 py-2 text-rose-700 hover:bg-rose-50" onClick={() => setDeleteTarget(entry)}>
                              <Trash2 className="h-4 w-4" /> Удалить
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!loading && entriesPage.content.length === 0 && (
              <div className="px-6 py-10 text-center text-sm font-semibold text-slate-500">
                Записей пока нет
              </div>
            )}
          </div>

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
          {typesLoading ? 'Загрузка типов журналов...' : 'Выберите тип журнала, чтобы увидеть записи.'}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Удалить запись журнала?"
        description="Запись будет удалена из выбранного журнала."
        confirmText="Удалить"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
};

export default LabJournalsPage;
