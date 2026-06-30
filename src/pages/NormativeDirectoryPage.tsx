import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Archive, Edit3, FileSpreadsheet, RefreshCw, Search } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { templateName } from '../data/protocolTemplates';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { archiveNormative, getNormatives, importNormativesExcel, updateNormative, type NormativeImportPreview } from '../services/normativeService';
import { getApiStatus } from '../services/apiHelpers';
import type { NormativeRecord } from '../types/protocols';

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';

const environmentOptions = [
  'Атмосферный воздух',
  'Воздух рабочей зоны',
  'Вода',
  'Почва',
  'Физические факторы',
  'Специальные УДМГ',
];

const typeOptions = ['ПДК', 'ОБУВ', 'ПДУ', 'ADI', 'Exposure limit'];
const subtypeOptions = ['Максимальная разовая', 'Среднесуточная', 'Среднесменная', 'Разовая', 'Суточная'];

const templateEnvironment: Record<string, string> = {
  ambient_air: 'Атмосферный воздух',
  atmospheric_air: 'Атмосферный воздух',
  workplace_air: 'Воздух рабочей зоны',
  water_wastewater: 'Вода',
  soil: 'Почва',
  physical_factors: 'Физические факторы',
  industrial_emissions: 'Атмосферный воздух',
};

const typeLabels: Record<string, string> = {
  PDK: 'ПДК',
  MPC: 'ПДК',
  OBUV: 'ОБУВ',
  PDU: 'ПДУ',
  ADI: 'ADI',
  EXPOSURE_LIMIT: 'Exposure limit',
};

const subtypeLabels: Record<string, string> = {
  MAX_ONE_TIME: 'Максимальная разовая',
  MAX_SINGLE: 'Максимальная разовая',
  AVERAGE_DAILY: 'Среднесуточная',
  DAILY_AVERAGE: 'Среднесуточная',
  SHIFT_AVERAGE: 'Среднесменная',
  SINGLE: 'Разовая',
  DAILY: 'Суточная',
};

const normalizeSearch = (value: unknown) => String(value || '').trim().toLowerCase().replace(/ё/g, 'е');

const textValue = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
};

const displayEnvironment = (item: NormativeRecord) =>
  textValue(item.environment, item.researchObject, templateEnvironment[item.templateId], templateName(item.templateId));

const displayType = (item: NormativeRecord) => {
  const raw = textValue(item.normativeType);
  return typeLabels[raw.toUpperCase().replace(/[\s-]+/g, '_')] || raw;
};

const displaySubtype = (item: NormativeRecord) => {
  const raw = textValue(item.normativeSubType, item.subtype);
  return subtypeLabels[raw.toUpperCase().replace(/[\s-]+/g, '_')] || raw;
};

const displayNormative = (item: NormativeRecord) => {
  if (item.value) return item.value;
  if (item.min && item.max) return `${item.min} - ${item.max}`;
  return textValue(item.max, item.min);
};

const recordSearchText = (item: NormativeRecord) => normalizeSearch([
  item.code,
  item.pollutantCode,
  item.indicator,
  item.indicatorName,
  item.pollutantName,
  item.cas,
  item.casNumber,
  item.formula,
  item.chemicalFormula,
  displayEnvironment(item),
  displayType(item),
  displaySubtype(item),
  item.unit,
  item.normativeDocument,
  item.source,
  item.sourceFile,
  item.importFileName,
].filter(Boolean).join(' '));

const matchesOption = (value: string, option: string) => {
  if (!option) return true;
  const left = normalizeSearch(value);
  const right = normalizeSearch(option);
  return left === right || left.includes(right) || right.includes(left);
};

const NormativeDirectoryPage = () => {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = ['ADMIN', 'DIRECTOR', 'HEAD'].includes(user?.role || '');
  const [items, setItems] = useState<NormativeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [subtypeFilter, setSubtypeFilter] = useState('');
  const [editing, setEditing] = useState<NormativeRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<NormativeImportPreview | null>(null);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getNormatives({ search: query.trim() || undefined, status: 'ACTIVE' }));
    } catch (loadError) {
      const status = getApiStatus(loadError);
      setError(status === 401 || status === 403
        ? 'Нет доступа к нормативам'
        : loadError instanceof Error ? loadError.message : 'Не удалось загрузить нормативы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(load, query.trim() ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filtered = useMemo(() => items.filter((item) => {
    const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
    const matchesQuery = !terms.length || terms.every((term) => recordSearchText(item).includes(term));
    const matchesEnvironment = matchesOption(displayEnvironment(item), environmentFilter);
    const matchesType = matchesOption(displayType(item), typeFilter);
    const matchesSubtype = matchesOption(displaySubtype(item), subtypeFilter);
    return matchesQuery && matchesEnvironment && matchesType && matchesSubtype && !item.archived;
  }), [items, query, environmentFilter, typeFilter, subtypeFilter]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !canManage) return;
    const form = new FormData(event.currentTarget);
    const payload: Partial<NormativeRecord> = {
      indicator: String(form.get('indicator') || ''),
      indicatorName: String(form.get('indicator') || ''),
      cas: String(form.get('cas') || ''),
      casNumber: String(form.get('cas') || ''),
      formula: String(form.get('formula') || ''),
      value: String(form.get('value') || ''),
      unit: String(form.get('unit') || ''),
      normativeSubType: String(form.get('normativeSubType') || ''),
      subtype: String(form.get('normativeSubType') || ''),
      hazardClass: String(form.get('hazardClass') || ''),
      limitingIndicator: String(form.get('limitingIndicator') || ''),
      normativeDocument: String(form.get('normativeDocument') || ''),
      active: form.get('active') === 'on',
      status: form.get('active') === 'on' ? 'ACTIVE' : 'INACTIVE',
    };

    try {
      const saved = await updateNormative(editing.id, payload);
      setItems((current) => current.map((item) => item.id === editing.id ? { ...item, ...saved } : item));
      setEditing(null);
      toast.success('Норматив обновлен');
    } catch (submitError) {
      toast.error('Не удалось сохранить норматив', submitError instanceof Error ? submitError.message : undefined);
    }
  };

  const archive = async (item: NormativeRecord) => {
    if (!canManage || !window.confirm(`Архивировать норматив "${item.indicator}"?`)) return;
    try {
      await archiveNormative(item.id);
      setItems((current) => current.filter((record) => record.id !== item.id));
      toast.success('Норматив архивирован');
    } catch (archiveError) {
      toast.error('Не удалось архивировать норматив', archiveError instanceof Error ? archiveError.message : undefined);
    }
  };

  const previewImport = async (file: File) => {
    setImportFile(file);
    setImporting(true);
    try {
      setImportPreview(await importNormativesExcel(file, true));
    } catch (importError) {
      toast.error('Не удалось проверить файл', importError instanceof Error ? importError.message : undefined);
    } finally {
      setImporting(false);
    }
  };

  const commitImport = async () => {
    if (!importFile || !canManage) return;
    setImporting(true);
    try {
      const result = await importNormativesExcel(importFile, false, importPreview?.importId);
      toast.success(`Импорт завершен: ${result.valid} строк`);
      setImportOpen(false);
      setImportFile(null);
      setImportPreview(null);
      await load();
    } catch (importError) {
      toast.error('Импорт не выполнен', importError instanceof Error ? importError.message : undefined);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-white pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">Нормативы</h1>
          <p className="mt-1 text-sm text-slate-500">Справочник ПДК, ОБУВ, ПДУ и других нормативов.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4" /> Импорт Excel
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Обновить
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название, код, CAS, формула"
            className={`${inputClass} pl-10`}
          />
        </label>
        <select value={environmentFilter} onChange={(event) => setEnvironmentFilter(event.target.value)} className={inputClass}>
          <option value="">Тип среды: все</option>
          {environmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={inputClass}>
          <option value="">Тип норматива: все</option>
          {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={subtypeFilter} onChange={(event) => setSubtypeFilter(event.target.value)} className={inputClass}>
          <option value="">Подтип: все</option>
          {subtypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <p className="text-xs font-semibold text-slate-500 md:col-span-2 xl:col-span-4">
          Загружено: {items.length}. Показано: {filtered.length}.
        </p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1540px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Тип среды</th>
                <th className="px-4 py-3">Код</th>
                <th className="px-4 py-3">Наименование вещества / показателя</th>
                <th className="px-4 py-3">CAS</th>
                <th className="px-4 py-3">Формула</th>
                <th className="px-4 py-3">Норматив</th>
                <th className="px-4 py-3">Подтип</th>
                <th className="px-4 py-3">Ед. изм.</th>
                <th className="px-4 py-3">Класс опасности</th>
                <th className="px-4 py-3">Лимитирующий показатель</th>
                <th className="px-4 py-3">Источник</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                  {Array.from({ length: 12 }).map((__, cell) => <td key={cell} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td>)}
                </tr>
              )) : filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">{displayEnvironment(item) || '-'}</td>
                  <td className="px-4 py-4 font-black text-eco-800">{item.pollutantCode || item.code || '-'}</td>
                  <td className="px-4 py-4 font-bold text-slate-900">{item.indicator || item.indicatorName || '-'}</td>
                  <td className="px-4 py-4">{item.cas || item.casNumber || '-'}</td>
                  <td className="px-4 py-4">{item.formula || item.chemicalFormula || '-'}</td>
                  <td className="px-4 py-4 font-semibold">{displayNormative(item) || '-'}</td>
                  <td className="px-4 py-4">{displaySubtype(item) || '-'}</td>
                  <td className="px-4 py-4">{item.unit || '-'}</td>
                  <td className="px-4 py-4">{item.hazardClass || '-'}</td>
                  <td className="px-4 py-4">{item.limitingIndicator || '-'}</td>
                  <td className="px-4 py-4">{item.sourceFile || item.importFileName || item.source || item.normativeDocument || '-'}</td>
                  <td className="px-4 py-4">
                    {canManage ? (
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" className="px-3" title="Изменить" onClick={() => setEditing(item)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="secondary" className="px-3" title="Архивировать" onClick={() => archive(item)}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : <span className="block text-right text-slate-400">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !error && filtered.length === 0 && (
          <p className="px-6 py-10 text-center text-sm font-semibold text-slate-500">Нормативы не загружены. Обратитесь к администратору или выполните импорт Excel.</p>
        )}
      </div>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Изменить норматив" size="lg">
        {editing && (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            {[
              ['indicator', 'Наименование', editing.indicator || editing.indicatorName],
              ['cas', 'CAS', editing.cas || editing.casNumber],
              ['formula', 'Формула', editing.formula || editing.chemicalFormula],
              ['value', 'Норматив', displayNormative(editing)],
              ['unit', 'Ед. изм.', editing.unit],
              ['normativeSubType', 'Подтип', displaySubtype(editing)],
              ['hazardClass', 'Класс опасности', editing.hazardClass],
              ['limitingIndicator', 'Лимитирующий показатель', editing.limitingIndicator],
              ['normativeDocument', 'Нормативный документ', editing.normativeDocument],
            ].map(([name, label, value]) => (
              <label key={name} className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span>{label}</span>
                <input name={name} defaultValue={String(value || '')} className={inputClass} />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input name="active" type="checkbox" defaultChecked={editing.active !== false} className="h-4 w-4 rounded border-slate-300 text-eco-700" /> Активен
            </label>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Отмена</Button>
              <Button type="submit">Сохранить</Button>
            </div>
          </form>
        )}
      </Modal>

      {canManage && (
        <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Импорт нормативов из Excel" description="Сначала файл проверяется, затем импорт подтверждается." size="lg" loading={importing}>
          <input type="file" accept=".xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; if (file) previewImport(file); }} className={inputClass} />
          {importPreview && <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">Всего</p><p className="text-xl font-black">{importPreview.total}</p></div>
              <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-700">Валидных</p><p className="text-xl font-black text-emerald-800">{importPreview.valid}</p></div>
              <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs font-bold text-rose-700">Ошибок</p><p className="text-xl font-black text-rose-800">{importPreview.invalid}</p></div>
              <div className="rounded-xl bg-sky-50 p-3"><p className="text-xs font-bold text-sky-700">Новых</p><p className="text-xl font-black text-sky-800">{importPreview.created ?? 0}</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs font-bold text-amber-700">Обновляемых</p><p className="text-xl font-black text-amber-800">{importPreview.updated ?? 0}</p></div>
            </div>
            {importPreview.items.length > 0 && <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50"><tr><th className="p-3">Код</th><th className="p-3">Показатель</th><th className="p-3">Норматив</th></tr></thead>
                <tbody>{importPreview.items.slice(0, 50).map((item, index) => <tr key={`${item.id}-${index}`} className="border-t border-slate-100"><td className="p-3">{item.pollutantCode || item.code || '-'}</td><td className="p-3">{item.indicator}</td><td className="p-3">{displayNormative(item)}</td></tr>)}</tbody>
              </table>
            </div>}
            {importPreview.errors.length > 0 && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{importPreview.errors.slice(0, 10).map((item, index) => <p key={index}>Строка {item.row || '-'}: {item.message}</p>)}</div>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setImportOpen(false)}>Отмена</Button>
              <Button type="button" disabled={!importPreview.valid || importing} onClick={commitImport}>Подтвердить импорт</Button>
            </div>
          </div>}
        </Modal>
      )}
    </div>
  );
};

export default NormativeDirectoryPage;
