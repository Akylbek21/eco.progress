import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Archive, Edit3, FileSpreadsheet, RefreshCw, Search } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { templateName } from '../data/protocolTemplates';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { archiveNormative, getNormatives, importDsm32FromResources, importNormativesExcel, importPhysicalFactorsFromResources, updateNormative, type NormativeImportPreview } from '../services/normativeService';
import { getApiStatus } from '../services/apiHelpers';
import type { NormativeRecord } from '../types/protocols';

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
type DirectoryTab = 'ambient_air' | 'soil' | 'physical_factors';
const emptyImportPreview: NormativeImportPreview = {
  items: [],
  total: 0,
  valid: 0,
  invalid: 0,
  created: 0,
  updated: 0,
  errors: [],
};

const environmentOptions = [
  'Атмосферный воздух',
  'Воздух рабочей зоны',
  'Вода',
  'Почва',
  'Физические факторы',
  'Специальные УДМГ',
];

const typeOptions = ['ПДК', 'Оценочная матрица', 'ОБУВ', 'ПДУ', 'ADI', 'Exposure limit'];
const soilFormOptions = ['подвижная форма', 'водорастворимая форма'];
const subtypeOptions = ['Максимальная разовая', 'Среднесуточная', 'Среднесменная', 'Разовая', 'Суточная'];
const sourceDocumentOptions = [
  { value: '', label: 'Документ: все' },
  { value: 'DSM_70', label: 'ДСМ-70' },
  { value: 'DSM_32', label: 'ДСМ-32' },
  { value: 'DSM_15', label: 'ДСМ-15' },
];
const factorTypeOptions = ['MICROCLIMATE', 'LIGHTING', 'NOISE', 'VIBRATION', 'NOISE_VIBRATION', 'INFRASOUND', 'ULTRASOUND', 'UV', 'AEROIONS', 'ELECTROMAGNETIC_FIELD', 'LASER'];
const directoryTabs: Array<{ key: DirectoryTab; label: string; sourceDocumentCode?: string; templateId?: string }> = [
  { key: 'ambient_air', label: 'Атмосферный воздух', sourceDocumentCode: 'DSM_70', templateId: 'ambient_air' },
  { key: 'soil', label: 'Почва / среда обитания', sourceDocumentCode: 'DSM_32', templateId: 'soil' },
  { key: 'physical_factors', label: 'Физические факторы', sourceDocumentCode: 'DSM_15', templateId: 'physical_factors' },
];

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
  ASSESSMENT_MATRIX: 'Оценочная матрица',
  MATRIX: 'Оценочная матрица',
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
    const text = value === undefined || value === null ? '' : String(value).trim();
    if (text) return text;
  }
  return '';
};

type NormativeTableRow = {
  key: string;
  records: NormativeRecord[];
  primary: NormativeRecord;
  maxOneTimeValue: string;
  dailyAverageValue: string;
  generalValue: string;
  unit: string;
};

const displayEnvironment = (item: NormativeRecord) =>
  textValue(item.environment, item.researchObject, templateEnvironment[item.templateId], templateName(item.templateId));

const displayType = (item: NormativeRecord) => {
  if (item.comparisonType === 'INFO' || item.matrixType || item.assessmentCategory || ['2', '3', '4'].includes(textValue(item.tableNo))) return 'Оценочная матрица';
  const raw = textValue(item.normativeType);
  return typeLabels[raw.toUpperCase().replace(/[\s-]+/g, '_')] || raw;
};

const displaySubtype = (item: NormativeRecord) => {
  const raw = textValue(item.normativeSubType, item.subtype);
  return subtypeLabels[raw.toUpperCase().replace(/[\s-]+/g, '_')] || raw;
};

const displayNormative = (item: NormativeRecord) => {
  const value = textValue(item.value);
  const min = textValue(item.min);
  const max = textValue(item.max);
  if (value) return value;
  if (min && max) return `${displayNormativeCell(min)}-${displayNormativeCell(max)}`;
  return textValue(max, min);
};

const normalizedTypeKey = (value: unknown) => textValue(value).toUpperCase().replace(/[\s-]+/g, '_');
const normalizedItemType = (item: NormativeRecord) => normalizedTypeKey(item.normativeType);
const normalizedItemSubtype = (item: NormativeRecord) => normalizedTypeKey(textValue(item.normativeSubType, item.subtype));
const displayCell = (...values: unknown[]) => textValue(...values) || '-';
const formatNormativeNumber = (value: unknown) => {
  const text = textValue(value);
  if (!text || text === '-') return text || '-';
  const normalized = text.replace(/\s+/g, '').replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return text;
  const [integer, fraction = ''] = normalized.split('.');
  const trimmedFraction = fraction.replace(/0+$/, '');
  return trimmedFraction ? `${integer},${trimmedFraction}` : integer;
};
const displayNormativeCell = (...values: unknown[]) => formatNormativeNumber(textValue(...values));

const itemEnvironmentText = (item: NormativeRecord) => normalizeSearch([
  item.templateId,
  item.sourceDocumentCode,
  item.sourceDocumentName,
  item.normativeDocument,
  item.environmentType,
  item.environment,
  item.researchObject,
  displayEnvironment(item),
].filter(Boolean).join(' '));

const itemDocumentText = (item: NormativeRecord) => normalizeSearch([
  item.sourceDocumentCode,
  item.sourceDocumentName,
  item.normativeDocument,
  item.source,
].filter(Boolean).join(' ')).replace(/-/g, '_');

const hasDocumentCode = (item: NormativeRecord, code: string) =>
  itemDocumentText(item).includes(code.toLowerCase().replace(/-/g, '_'));

const normalizedDocumentCode = (item: NormativeRecord) =>
  textValue(item.sourceDocumentCode).toUpperCase().replace(/-/g, '_');

const isDsm32SoilRecord = (item: NormativeRecord) =>
  item.templateId === 'soil'
  && normalizedDocumentCode(item) === 'DSM_32'
  && item.active !== false
  && !item.archived;

const isAtmosphericAir = (item: NormativeRecord) => {
  const text = itemEnvironmentText(item);
  const isDsm70 = hasDocumentCode(item, 'DSM_70') || hasDocumentCode(item, 'ДСМ_70');
  return text.includes('ambient_air')
    || text.includes('atmospheric_air')
    || text.includes('atmospheric')
    || text.includes('atmosphere')
    || text.includes('industrial_emissions')
    || text.includes('атмосфер')
    || (isDsm70 && item.templateId !== 'workplace_air' && !isWorkZoneAir(item));
};

const isWorkZoneAir = (item: NormativeRecord) => {
  const text = itemEnvironmentText(item);
  return text.includes('workplace_air')
    || text.includes('work_zone_air')
    || text.includes('workplace')
    || text.includes('work_zone')
    || text.includes('working_zone')
    || text.includes('рабочей зоны')
    || text.includes('рабочая зона');
};

const isSoilNormative = (item: NormativeRecord) => {
  return isDsm32SoilRecord(item);
};

const isPhysicalNormative = (item: NormativeRecord) => {
  const text = itemEnvironmentText(item);
  return hasDocumentCode(item, 'DSM_15')
    || hasDocumentCode(item, 'ДСМ_15')
    || ['physical_factors', 'microclimate', 'lighting', 'noise_vibration'].includes(item.templateId)
    || Boolean(item.factorType || item.factorCode)
    || text.includes('физичес');
};

const fallbackUnitForItem = (item: NormativeRecord) => {
  if (item.unit) return item.unit;
  const text = itemEnvironmentText(item);
  if (isAtmosphericAir(item) || isWorkZoneAir(item)) return 'мг/м³';
  if (text.includes('water') || text.includes('вод')) return 'мг/дм³';
  if (text.includes('soil') || text.includes('почв')) return 'мг/кг';
  if (text.includes('surface') || text.includes('поверх')) return 'мг/см²';
  if (text.includes('food') || text.includes('пищ')) return 'мг/кг';
  return '';
};

const firstGroupValue = (row: NormativeTableRow, getter: (item: NormativeRecord) => unknown) =>
  textValue(...row.records.map(getter));

const groupKey = (item: NormativeRecord, index: number) => {
  const codeKey = textValue(item.code, item.pollutantCode);
  if (codeKey) return `code:${codeKey}`;
  const casKey = textValue(item.casNumber, item.cas);
  if (casKey) return `cas:${casKey}`;
  const nameFormulaKey = [textValue(item.indicatorName, item.indicator, item.pollutantName), textValue(item.formula, item.chemicalFormula)].filter(Boolean).join('|');
  return nameFormulaKey ? `name:${normalizeSearch(nameFormulaKey)}` : `record:${item.id || index}`;
};

const putGroupedValue = (current: string, next: string) => current || next;

const addNormativeToRow = (row: NormativeTableRow, item: NormativeRecord) => {
  const type = normalizedItemType(item);
  const subtype = normalizedItemSubtype(item);
  const value = textValue(displayNormative(item));

  if (subtype === 'MAX_ONE_TIME' || subtype === 'MAX_SINGLE') {
    row.maxOneTimeValue = putGroupedValue(row.maxOneTimeValue, textValue(item.maxOneTimeValue, value));
  } else if (subtype === 'DAILY_AVERAGE' || subtype === 'AVERAGE_DAILY' || subtype === 'DAILY') {
    row.dailyAverageValue = putGroupedValue(row.dailyAverageValue, textValue(item.dailyAverageValue, value));
  } else if (subtype === 'SINGLE_VALUE' || subtype === 'SINGLE' || subtype === 'SHIFT_AVERAGE') {
    row.generalValue = putGroupedValue(row.generalValue, textValue(item.singleValue, value));
  }

  if (type === 'OBUV' || type === 'ОБУВ') {
    row.generalValue = putGroupedValue(row.generalValue, textValue(item.obuvValue, value));
  }

  row.maxOneTimeValue = putGroupedValue(row.maxOneTimeValue, item.maxOneTimeValue || '');
  row.dailyAverageValue = putGroupedValue(row.dailyAverageValue, item.dailyAverageValue || '');
  row.generalValue = putGroupedValue(row.generalValue, textValue(item.obuvValue, item.singleValue));
  row.unit = putGroupedValue(row.unit, fallbackUnitForItem(item));
};

const groupNormatives = (records: NormativeRecord[]) => {
  const rows = new Map<string, NormativeTableRow>();
  records.forEach((item, index) => {
    const key = groupKey(item, index);
    const existing = rows.get(key);
    if (existing) {
      existing.records.push(item);
      addNormativeToRow(existing, item);
      return;
    }
    const row: NormativeTableRow = {
      key,
      records: [item],
      primary: item,
      maxOneTimeValue: '',
      dailyAverageValue: '',
      generalValue: '',
      unit: '',
    };
    addNormativeToRow(row, item);
    rows.set(key, row);
  });
  return Array.from(rows.values());
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
  item.hazardClass,
  item.limitingIndicator,
  item.formType,
  item.matrixType,
  item.assessmentCategory,
  item.pollutionDegree,
  item.tableNo,
  item.conditionJson,
  item.maxOneTimeValue,
  item.dailyAverageValue,
  item.singleValue,
  item.obuvValue,
  item.aggregateState,
  item.actionFeatures,
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
  const canImportResources = user?.role === 'ADMIN';
  const [items, setItems] = useState<NormativeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<DirectoryTab>('ambient_air');
  const [query, setQuery] = useState('');
  const [sourceDocumentFilter, setSourceDocumentFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [subtypeFilter, setSubtypeFilter] = useState('');
  const [factorTypeFilter, setFactorTypeFilter] = useState('');
  const [appendixFilter, setAppendixFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [formTypeFilter, setFormTypeFilter] = useState('');
  const [editing, setEditing] = useState<NormativeRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<NormativeImportPreview | null>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importingResources, setImportingResources] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const tab = directoryTabs.find((item) => item.key === activeTab);
      setItems(await getNormatives({
        search: query.trim() || undefined,
        status: 'ACTIVE',
        sourceDocumentCode: sourceDocumentFilter || tab?.sourceDocumentCode,
        templateId: templateFilter || tab?.templateId,
        environmentType: environmentFilter || undefined,
        factorType: factorTypeFilter || undefined,
        appendixNo: appendixFilter || undefined,
        tableNo: tableFilter || undefined,
        formType: formTypeFilter || undefined,
        normativeType: typeFilter || undefined,
        subtype: subtypeFilter || undefined,
      }));
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
  }, [query, activeTab, sourceDocumentFilter, templateFilter, environmentFilter, factorTypeFilter, appendixFilter, tableFilter, formTypeFilter, typeFilter, subtypeFilter]);

  const filtered = useMemo(() => items.filter((item) => {
    const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
    const matchesQuery = !terms.length || terms.every((term) => recordSearchText(item).includes(term));
    const documentCode = textValue(item.sourceDocumentCode).toUpperCase().replace(/-/g, '_');
    const matchesTab = activeTab === 'ambient_air'
      ? isAtmosphericAir(item) && !isPhysicalNormative(item) && !isSoilNormative(item)
      : activeTab === 'soil'
        ? isSoilNormative(item)
        : activeTab === 'physical_factors'
          ? (documentCode === 'DSM_15' || hasDocumentCode(item, 'DSM_15') || hasDocumentCode(item, 'ДСМ_15'))
            && ['physical_factors', 'microclimate', 'lighting', 'noise_vibration'].includes(item.templateId)
          : true;
    const matchesDocument = matchesOption(item.sourceDocumentCode || '', sourceDocumentFilter);
    const matchesTemplate = matchesOption(item.templateId || '', templateFilter);
    const matchesFactorType = matchesOption(item.factorType || '', factorTypeFilter);
    const matchesAppendix = matchesOption(item.appendixNo || '', appendixFilter);
    const matchesTable = matchesOption(item.tableNo || '', tableFilter);
    const matchesForm = matchesOption(item.formType || item.normativeSubType || item.subtype || '', formTypeFilter);
    const matchesEnvironment = matchesOption(displayEnvironment(item), environmentFilter);
    const matchesType = matchesOption(displayType(item), typeFilter);
    const matchesSubtype = matchesOption(displaySubtype(item), subtypeFilter);
    return matchesTab && matchesQuery && matchesDocument && matchesTemplate && matchesFactorType && matchesAppendix && matchesTable && matchesForm && matchesEnvironment && matchesType && matchesSubtype && !item.archived;
  }), [items, query, activeTab, sourceDocumentFilter, templateFilter, factorTypeFilter, appendixFilter, tableFilter, formTypeFilter, environmentFilter, typeFilter, subtypeFilter]);

  const groupedRows = useMemo(() => groupNormatives(filtered), [filtered]);
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

  const archiveGroup = async (row: NormativeTableRow) => {
    const name = firstGroupValue(row, (item) => item.indicator || item.indicatorName || item.pollutantName);
    if (!canManage || !window.confirm(`Архивировать нормативы "${name}"?`)) return;
    try {
      await Promise.all(row.records.map((record) => archiveNormative(record.id)));
      const archivedIds = new Set(row.records.map((record) => record.id));
      setItems((current) => current.filter((record) => !archivedIds.has(record.id)));
      toast.success(row.records.length > 1 ? 'Нормативы архивированы' : 'Норматив архивирован');
    } catch (archiveError) {
      toast.error('Не удалось архивировать норматив', archiveError instanceof Error ? archiveError.message : undefined);
    }
  };

  const resetImportState = () => {
    setImportFile(null);
    setImportPreview(null);
    setImportError('');
    setImporting(false);
  };

  const openImport = () => {
    resetImportState();
    setImportOpen(true);
  };

  const importDsm15Resources = async () => {
    if (!canImportResources) return;
    setImportingResources(true);
    try {
      const result = await importPhysicalFactorsFromResources();
      toast.success(`Импорт завершен: создано ${result.created}, обновлено ${result.updated}, предупреждений ${result.warnings}`);
      await load();
    } catch (error) {
      toast.error('Не удалось импортировать ДСМ-15 из resources', error instanceof Error ? error.message : undefined);
    } finally {
      setImportingResources(false);
    }
  };

  const importDsm32Resources = async () => {
    if (!canImportResources) return;
    setImportingResources(true);
    try {
      const result = await importDsm32FromResources();
      toast.success(`ДСМ-32 импортирован: создано ${result.created}, обновлено ${result.updated}`);
      await load();
    } catch (error) {
      toast.error('Не удалось импортировать ДСМ-32', error instanceof Error ? error.message : undefined);
    } finally {
      setImportingResources(false);
    }
  };

  const closeImport = () => {
    setImportOpen(false);
    resetImportState();
  };

  const previewImport = async (file?: File) => {
    if (!file) {
      setImportError('Выберите файл Excel');
      toast.warning('Выберите файл Excel');
      return;
    }
    setImportFile(file);
    setImportPreview(null);
    setImportError('');
    setImporting(true);
    try {
      const preview = await importNormativesExcel(file, true);
      setImportPreview(preview);
      if (!preview.total || !preview.valid) {
        setImportError('Файл прочитан, но валидные строки нормативов не найдены. Проверьте формат таблицы.');
      }
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'Не удалось проверить файл';
      setImportError(message);
      toast.error('Не удалось проверить файл', message);
    } finally {
      setImporting(false);
    }
  };

  const commitImport = async () => {
    const stats = importPreview || emptyImportPreview;
    if (!importFile || !canManage) {
      setImportError('Выберите файл Excel');
      toast.warning('Выберите файл Excel');
      return;
    }
    if (!stats.importId || !stats.valid || importError) return;
    setImporting(true);
    try {
      await importNormativesExcel(importFile, false, stats.importId);
      toast.success('Нормативы импортированы');
      closeImport();
      await load();
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'Импорт не выполнен';
      setImportError(message);
      toast.error('Импорт не выполнен', message);
    } finally {
      setImporting(false);
    }
  };

  const importStats = importPreview || emptyImportPreview;
  const confirmImportDisabled = !importFile || !importStats.importId || !importStats.valid || importing || Boolean(importError);
  const displayedCount = activeTab === 'physical_factors' || activeTab === 'soil' ? filtered.length : groupedRows.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-white pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">Нормативы</h1>
          <p className="mt-1 text-sm text-slate-500">Справочник ПДК, ОБУВ, ПДУ и других нормативов.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canImportResources && (
            <Button type="button" variant="secondary" onClick={openImport}>
              <FileSpreadsheet className="h-4 w-4" /> Импорт Excel
            </Button>
          )}
          {activeTab === 'physical_factors' && canImportResources && (
            <Button type="button" variant="secondary" disabled={importingResources} onClick={importDsm15Resources}>
              <FileSpreadsheet className="h-4 w-4" /> Импортировать ДСМ-15 из backend resources
            </Button>
          )}
          {activeTab === 'soil' && canImportResources && (
            <Button type="button" variant="secondary" disabled={importingResources} onClick={importDsm32Resources}>
              <FileSpreadsheet className="h-4 w-4" /> Импортировать ДСМ-32
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Обновить
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {directoryTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${activeTab === tab.key ? 'bg-eco-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {tab.label}
          </button>
        ))}
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
        <select value={sourceDocumentFilter} onChange={(event) => setSourceDocumentFilter(event.target.value)} className={inputClass}>
          {sourceDocumentOptions.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
        </select>
        <select value={templateFilter} onChange={(event) => setTemplateFilter(event.target.value)} className={inputClass}>
          <option value="">templateId: все</option>
          <option value="ambient_air">ambient_air</option>
          <option value="workplace_air">workplace_air</option>
          <option value="industrial_emissions">industrial_emissions</option>
          <option value="soil">soil</option>
          <option value="physical_factors">physical_factors</option>
          <option value="microclimate">microclimate</option>
          <option value="lighting">lighting</option>
          <option value="noise_vibration">noise_vibration</option>
        </select>
        <select value={environmentFilter} onChange={(event) => setEnvironmentFilter(event.target.value)} className={inputClass}>
          <option value="">Тип среды: все</option>
          {environmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={factorTypeFilter} onChange={(event) => setFactorTypeFilter(event.target.value)} className={inputClass}>
          <option value="">factorType: все</option>
          {factorTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        {activeTab === 'soil' && (
          <select value={formTypeFilter} onChange={(event) => setFormTypeFilter(event.target.value)} className={inputClass}>
            <option value="">Форма: все</option>
            {soilFormOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        )}
        {(activeTab === 'physical_factors' || activeTab === 'soil') && (
          <>
            {activeTab === 'physical_factors' && (
              <input
                value={appendixFilter}
                onChange={(event) => setAppendixFilter(event.target.value)}
                placeholder="Приложение"
                className={inputClass}
              />
            )}
            <input
              value={tableFilter}
              onChange={(event) => setTableFilter(event.target.value)}
              placeholder="Таблица"
              className={inputClass}
            />
          </>
        )}
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={inputClass}>
          <option value="">Тип норматива: все</option>
          {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={subtypeFilter} onChange={(event) => setSubtypeFilter(event.target.value)} className={inputClass}>
          <option value="">Подтип: все</option>
          {subtypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <p className="text-xs font-semibold text-slate-500 md:col-span-2 xl:col-span-4">
          Загружено: {items.length}. Показано: {displayedCount}.
        </p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {activeTab === 'physical_factors' ? (
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Фактор</th>
                <th className="px-3 py-3">Показатель</th>
                <th className="px-3 py-3">Условия</th>
                <th className="px-3 py-3">Норматив</th>
                <th className="px-3 py-3">Ед.</th>
                <th className="px-3 py-3">Документ</th>
                <th className="px-3 py-3">Приложение</th>
                <th className="px-3 py-3">Таблица</th>
                <th className="px-3 py-3">Статус</th>
                <th className="px-3 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="animate-pulse">{Array.from({ length: 10 }).map((__, cell) => <td key={cell} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td>)}</tr>
              )) : filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-bold text-slate-900">{displayCell(item.factorType, item.subtype)}</td>
                  <td className="px-3 py-3"><p className="font-bold text-slate-900">{displayCell(item.indicator, item.indicatorName, item.pollutantName)}</p><p className="mt-1 text-xs font-black text-eco-800">{displayCell(item.factorCode, item.code, item.pollutantCode)}</p></td>
                  <td className="px-3 py-3 text-xs font-semibold text-slate-700">{[item.season, item.workCategory, item.workplaceType, item.roomType, item.normLevel].filter(Boolean).join(', ') || '-'}</td>
                  <td className="px-3 py-3 font-semibold">{displayNormativeCell(displayNormative(item))}</td>
                  <td className="px-3 py-3">{displayCell(item.unit)}</td>
                  <td className="px-3 py-3">{displayCell(item.sourceDocumentName, item.sourceDocumentCode, item.normativeDocument)}</td>
                  <td className="px-3 py-3">{displayCell(item.appendixNo)}</td>
                  <td className="px-3 py-3">{displayCell(item.tableNo)}</td>
                  <td className="px-3 py-3">{item.active === false ? 'Неактивен' : 'Активен'}</td>
                  <td className="px-3 py-3 text-right">{canManage ? <Button type="button" variant="secondary" className="px-3" onClick={() => setEditing(item)}><Edit3 className="h-4 w-4" /></Button> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          ) : activeTab === 'soil' ? (
          <table className="min-w-[1250px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Тип записи</th>
                <th className="px-3 py-3">Вещество / показатель</th>
                <th className="px-3 py-3">Форма</th>
                <th className="px-3 py-3">Норматив</th>
                <th className="px-3 py-3">Ед.</th>
                <th className="px-3 py-3">Лимитирующий показатель</th>
                <th className="px-3 py-3">Категория оценки</th>
                <th className="px-3 py-3">Документ</th>
                <th className="px-3 py-3">Таблица</th>
                <th className="px-3 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="animate-pulse">{Array.from({ length: 10 }).map((__, cell) => <td key={cell} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td>)}</tr>
              )) : filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-semibold">{displayType(item) || 'ПДК'}</td>
                  <td className="px-3 py-3 font-bold text-slate-900">{displayCell(item.assessmentCategory, item.indicator, item.indicatorName, item.pollutantName)}</td>
                  <td className="px-3 py-3">{displayCell(item.formType, item.aggregateState, item.normativeSubType, item.subtype)}</td>
                  <td className="px-3 py-3 font-semibold">{item.comparisonType === 'INFO' ? displayCell(item.value, item.conditionJson) : displayNormativeCell(displayNormative(item))}</td>
                  <td className="px-3 py-3">{displayCell(item.unit)}</td>
                  <td className="px-3 py-3">{displayCell(item.limitingIndicator)}</td>
                  <td className="px-3 py-3">{displayCell(item.assessmentCategory, item.pollutionDegree, item.matrixType)}</td>
                  <td className="px-3 py-3">{displayCell(item.sourceDocumentName, item.sourceDocumentCode, item.normativeDocument)}</td>
                  <td className="px-3 py-3">{displayCell(item.tableNo)}</td>
                  <td className="px-3 py-3 text-right">{canManage ? <Button type="button" variant="secondary" className="px-3" onClick={() => setEditing(item)}><Edit3 className="h-4 w-4" /></Button> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          ) : (
          <table className="min-w-[1290px] w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-3 py-3">№</th>
                <th className="w-[260px] px-3 py-3">Наименование вещества / показателя</th>
                <th className="w-[110px] px-3 py-3">CAS</th>
                <th className="w-[100px] px-3 py-3">Формула</th>
                <th className="w-[72px] px-2 py-3 text-center" title="ПДК максимально-разовая">М.р.</th>
                <th className="w-[72px] px-2 py-3 text-center" title="ПДК среднесуточная">С.с.</th>
                <th className="w-[72px] px-2 py-3 text-center" title="ОБУВ / общий норматив">ОБУВ</th>
                <th className="w-[92px] px-3 py-3">Ед.</th>
                <th className="w-28 px-3 py-3">ЛПВ</th>
                <th className="w-16 px-3 py-3">Класс</th>
                <th className="w-24 px-3 py-3">Код</th>
                <th className="w-28 px-3 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? Array.from({ length: 5 }).map((_, index) => (
                <tr key={index} className="animate-pulse">
                  {Array.from({ length: 12 }).map((__, cell) => <td key={cell} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td>)}
                </tr>
              )) : groupedRows.map((row, index) => {
                const item = row.primary;
                const substanceName = displayCell(firstGroupValue(row, (record) => record.indicator || record.indicatorName || record.pollutantName));
                const cas = displayCell(firstGroupValue(row, (record) => record.casNumber || record.cas));
                const formula = displayCell(firstGroupValue(row, (record) => record.formula || record.chemicalFormula));
                const limitingIndicator = displayCell(firstGroupValue(row, (record) => record.limitingIndicator));
                const hazardClass = displayCell(firstGroupValue(row, (record) => record.hazardClass));
                const pollutantCode = displayCell(firstGroupValue(row, (record) => record.pollutantCode || record.code));
                return (
                <tr key={row.key} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-semibold text-slate-600">{index + 1}</td>
                  <td className="px-3 py-3 font-bold text-slate-900"><div className="truncate" title={substanceName}>{substanceName}</div></td>
                  <td className="px-3 py-3"><div className="truncate" title={cas}>{cas}</div></td>
                  <td className="px-3 py-3"><div className="truncate" title={formula}>{formula}</div></td>
                  <td className="px-2 py-3 text-center text-xs font-semibold"><div className="truncate" title={displayCell(row.maxOneTimeValue)}>{displayNormativeCell(row.maxOneTimeValue)}</div></td>
                  <td className="px-2 py-3 text-center text-xs font-semibold"><div className="truncate" title={displayCell(row.dailyAverageValue)}>{displayNormativeCell(row.dailyAverageValue)}</div></td>
                  <td className="px-2 py-3 text-center text-xs font-semibold"><div className="truncate" title={displayCell(row.generalValue)}>{displayNormativeCell(row.generalValue)}</div></td>
                  <td className="px-3 py-3"><div className="truncate" title={displayCell(row.unit)}>{displayCell(row.unit)}</div></td>
                  <td className="px-3 py-3"><div className="truncate" title={limitingIndicator}>{limitingIndicator}</div></td>
                  <td className="px-3 py-3"><div className="truncate" title={hazardClass}>{hazardClass}</div></td>
                  <td className="px-3 py-3 font-black text-eco-800"><div className="truncate" title={pollutantCode}>{pollutantCode}</div></td>
                  <td className="px-3 py-3">
                    {canManage ? (
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" className="px-3" title="Изменить" onClick={() => setEditing(item)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="secondary" className="px-3" title="Архивировать" onClick={() => archiveGroup(row)}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : <span className="block text-right text-slate-400">-</span>}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
        {!loading && !error && displayedCount === 0 && (
          <p className="px-6 py-10 text-center text-sm font-semibold text-slate-500">Нормативы не загружены. Импортируйте Excel-файл.</p>
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
        <Modal open={importOpen} onClose={closeImport} title="Импорт нормативов из Excel" description="Сначала файл проверяется, затем импорт подтверждается." size="lg" loading={importing}>
          <div className="space-y-4">
            <input
              type="file"
              accept=".xls,.xlsx,.xls.xls"
              onChange={(event) => previewImport(event.target.files?.[0])}
              className={inputClass}
            />
            <div className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              {importFile ? (
                <span>Файл: <span className="font-black text-slate-950">{importFile.name}</span></span>
              ) : 'Выберите файл Excel для проверки'}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">Всего</p><p className="text-xl font-black">{importStats.total}</p></div>
              <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-700">Валидных</p><p className="text-xl font-black text-emerald-800">{importStats.valid}</p></div>
              <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs font-bold text-rose-700">Ошибок</p><p className="text-xl font-black text-rose-800">{importStats.invalid}</p></div>
              <div className="rounded-xl bg-sky-50 p-3"><p className="text-xs font-bold text-sky-700">Новых</p><p className="text-xl font-black text-sky-800">{importStats.created ?? 0}</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs font-bold text-amber-700">Обновляемых</p><p className="text-xl font-black text-amber-800">{importStats.updated ?? 0}</p></div>
            </div>
            {importing && <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-800">Проверяем файл...</div>}
            {importError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{importError}</div>}
            {importStats.items.length > 0 && <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50"><tr><th className="p-3">Код</th><th className="p-3">Показатель</th><th className="p-3">Норматив</th></tr></thead>
                <tbody>{importStats.items.slice(0, 50).map((item, index) => <tr key={`${item.id}-${index}`} className="border-t border-slate-100"><td className="p-3">{item.pollutantCode || item.code || '-'}</td><td className="p-3">{item.indicator}</td><td className="p-3">{displayNormative(item)}</td></tr>)}</tbody>
              </table>
            </div>}
            {importStats.errors.length > 0 && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{importStats.errors.slice(0, 10).map((item, index) => <p key={index}>Строка {item.row || '-'}: {item.message}</p>)}</div>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={closeImport}>Отмена</Button>
              <Button type="button" disabled={confirmImportDisabled} onClick={commitImport}>Подтвердить импорт</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default NormativeDirectoryPage;
