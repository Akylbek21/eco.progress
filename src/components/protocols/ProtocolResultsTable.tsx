import { useMemo, useRef, useState } from 'react';
import { Calculator, Copy, FileSpreadsheet, History, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import NormativeStatusBadge from './NormativeStatusBadge';
import RawMeasurementsModal from './RawMeasurementsModal';
import protocolService from '../../services/protocolService';
import { useAuth } from '../../contexts/AuthContext';
import type {
  CalculationDetails,
  CalculationResultResponse,
  Pollutant,
  ProtocolCalculationSummaryResponse,
  ProtocolMeasurementDevice,
  ProtocolResultPayload,
  ProtocolResultRow,
  ProtocolSubtype,
  ProtocolTemplateId,
} from '../../types/protocols';

type Props = {
  protocolId: string;
  templateId: ProtocolTemplateId;
  subtype?: ProtocolSubtype;
  rows: ProtocolResultRow[];
  devices?: ProtocolMeasurementDevice[];
  readOnly: boolean;
  busy?: boolean;
  testingDate?: string;
  allowManualIndicator?: boolean;
  onChange: (rows: ProtocolResultRow[]) => void;
  onCheckNormatives: () => void | Promise<void>;
  onImported: () => void | Promise<void>;
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
};

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';
const automaticClass = 'rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700';
const valueOf = (row: ProtocolResultRow, keys: string[]) => {
  for (const key of keys) {
    const value = row.values[key];
    if (value !== undefined && value !== null && String(value) !== '') return String(value);
  }
  return '';
};
const officialResult = (row: ProtocolResultRow, templateId: ProtocolTemplateId) => {
  if (row.result) return row.result;
  if (templateId === 'industrial_emissions') return valueOf(row, ['resultMg', 'calculatedConcentration', 'resultValue']);
  return valueOf(row, ['result', 'resultValue', 'calculatedResult']);
};
const normativeValue = (row: ProtocolResultRow) =>
  row.normativeReference?.value || row.normative || row.normativeValue || row.pdk || valueOf(row, ['normative', 'pdk', 'normativeMax', 'normativeMin']) || row.normativeMax || row.normativeMin || '';
const pollutantCode = (row: ProtocolResultRow) => row.pollutant?.code || row.code || valueOf(row, ['pollutantCode', 'code']);
const indicator = (row: ProtocolResultRow) => row.pollutant?.name || row.indicatorName || row.indicator || valueOf(row, ['indicator', 'substanceName']);
const unit = (row: ProtocolResultRow) => row.unit || valueOf(row, ['unit']);
const manualPollutantFromText = (text: string): Pollutant => {
  const value = text.trim();
  const firstToken = value.split(/\s+/)[0] || value;
  return { code: firstToken, name: value };
};
const primaryReading = (row: ProtocolResultRow) => valueOf(row, ['primaryReading', 'measurementReadings', 'readings', 'concentration']);
const rawDataLabel = (row: ProtocolResultRow) =>
  primaryReading(row)
  || ['reading1', 'reading2', 'sampleWeight', 'volume'].map((key) => valueOf(row, [`raw_${key}`, key])).filter(Boolean).join(', ');
const measurementPlace = (row: ProtocolResultRow) => row.measurementPlace || valueOf(row, ['measurementPlace', 'samplingPlace', 'object']);
const testingMethod = (row: ProtocolResultRow) => row.testingMethodDocument || row.testingMethod || valueOf(row, ['testingMethodDocument', 'testingMethod']);
const statusOf = (row: ProtocolResultRow) =>
  (row.internalStatus || row.checkStatus) === 'NORMATIVE_NOT_FOUND' && normativeValue(row)
    ? 'MANUAL_NORMATIVE'
    : row.internalStatus || row.checkStatus;

const calculationStatusLabel = (status?: string) => ({
  WAITING_INPUTS: 'Ожидает исходные данные',
  CALCULATED: 'Рассчитано',
  MANUAL: 'Ручной ввод',
  ERROR: 'Ошибка расчета',
  NEEDS_REPEAT: 'Требуется повторный анализ',
  NORMATIVE_NOT_FOUND: 'Норматив не найден',
}[String(status || '')] || '');

const uncertaintyValue = (row: ProtocolResultRow) => row.uncertaintyValue || valueOf(row, ['uncertaintyValue', 'uncertainty']);

const resolveDeviceName = (row: ProtocolResultRow, devices: ProtocolMeasurementDevice[]) => {
  const ids = [
    row.deviceId,
    row.measurementDeviceId,
    valueOf(row, ['device', 'deviceId', 'measurementDeviceId']),
  ].filter(Boolean).map(String);
  const device = devices.find((item) => ids.includes(String(item.deviceId)) || ids.includes(String(item.id)));
  const name = device?.deviceSnapshot.name || row.deviceName || valueOf(row, ['deviceName']);
  return name && name !== '—' ? name : '';
};

const exceededText = (row: ProtocolResultRow, templateId: ProtocolTemplateId) => {
  if (statusOf(row) !== 'EXCEEDED') return '';
  const actual = Number(officialResult(row, templateId).replace(',', '.'));
  const limit = Number(normativeValue(row).replace(',', '.'));
  if (!Number.isFinite(actual) || !Number.isFinite(limit) || !limit) return '';
  return `Факт: ${officialResult(row, templateId)} ${unit(row)} · Норматив: ${normativeValue(row)} ${unit(row)} · Превышение: ${Math.max(0, ((actual - limit) / limit) * 100).toFixed(0)}%`;
};

const ProtocolResultsTable = ({
  protocolId, templateId, subtype, rows, devices = [], readOnly, busy = false, testingDate = '',
  onChange, onCheckNormatives, onImported, onNotify,
}: Props) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Pollutant[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkDeviceId, setBulkDeviceId] = useState('');
  const [bulkPlace, setBulkPlace] = useState('');
  const [editing, setEditing] = useState<ProtocolResultRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [calculation, setCalculation] = useState<{ row: ProtocolResultRow; details: CalculationDetails } | null>(null);
  const [calculationHistory, setCalculationHistory] = useState<CalculationResultResponse[] | null>(null);
  const [deleteRow, setDeleteRow] = useState<ProtocolResultRow | null>(null);
  const [rawRow, setRawRow] = useState<ProtocolResultRow | null>(null);
  const [calculationSummary, setCalculationSummary] = useState<ProtocolCalculationSummaryResponse | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [extraActionsOpen, setExtraActionsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canUseAdvanced = user?.role === 'ADMIN' || user?.role === 'HEAD' || user?.role === 'DIRECTOR';

  const selectedRows = useMemo(() => rows.filter((row) => selected.includes(row.id)), [rows, selected]);
  const reviewRow = rows.find((row) => ['EXCEEDED', 'BELOW_REQUIRED', 'UNIT_MISMATCH', 'NEEDS_REVIEW', 'MANUAL_NORMATIVE'].includes(String(statusOf(row))));

  const search = async (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) return setSuggestions([]);
    setSearching(true);
    try {
      setSuggestions((await protocolService.searchPollutants(value, { templateId, subtype: subtype || '' })).slice(0, 8));
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  const addPollutant = async (pollutant: Pollutant, append = true): Promise<ProtocolResultRow | null> => {
    setSaving(true);
    try {
      const found = await protocolService.searchNormative({
        templateId, subtype: subtype || '', code: pollutant.code, indicator: pollutant.name,
        unit: pollutant.unit || '', date: testingDate,
      }).catch(() => ({ found: false, normatives: [], items: [], normative: undefined }));
      const candidates = found.normatives || found.items || (found.normative ? [found.normative] : []);
      const normative = candidates.length === 1 ? candidates[0] : undefined;
      const saved = await protocolService.addProtocolResult(protocolId, {
        normativeId: normative?.id,
        values: {
          pollutantCode: pollutant.code,
          indicator: pollutant.name,
          cas: pollutant.cas || '',
          formula: pollutant.formula || '',
          unit: normative?.unit || pollutant.unit || '',
          primaryReading: '',
          normative: normative?.value || '',
          normativeMin: normative?.min || '',
          normativeMax: normative?.max || normative?.value || '',
          normativeDocument: normative?.normativeDocument || '',
          testingMethod: normative?.testingMethod || pollutant.testingMethod || '',
          normativeSelectionRequired: candidates.length > 1 ? 'true' : '',
        },
      });
      if (append) onChange([...rows, saved]);
      setQuery('');
      setSuggestions([]);
      onNotify(candidates.length > 1 ? 'Строка добавлена. Требуется выбрать норматив.' : candidates.length ? 'Вещество и норматив добавлены' : 'Вещество добавлено, норматив не найден', candidates.length ? 'success' : 'warning');
      return saved;
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось добавить вещество', 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const addBulk = async () => {
    const tokens = query.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
    if (!tokens.length) {
      onNotify('Введите код или название показателя', 'warning');
      return;
    }
    setSearching(true);
    try {
      const found = await protocolService.searchPollutants(tokens.join(','), { templateId, subtype: subtype || '' }).catch(() => []);
      const created: ProtocolResultRow[] = [];
      for (const token of tokens) {
        const normalized = token.toLowerCase();
        const item = found.find((pollutant) => pollutant.code.toLowerCase() === normalized)
          || found.find((pollutant) => `${pollutant.code} ${pollutant.name}`.toLowerCase().includes(normalized))
          || (tokens.length === 1 ? found[0] : undefined)
          || manualPollutantFromText(token);
        const exists = [...rows, ...created].some((row) => pollutantCode(row).toLowerCase() === item.code.toLowerCase());
        if (!exists) {
          const saved = await addPollutant(item, false);
          if (saved) created.push(saved);
        }
      }
      if (created.length) {
        onChange([...rows, ...created]);
        setQuery('');
        setSuggestions([]);
      }
    } finally {
      setSearching(false);
    }
  };

  const openEdit = (row: ProtocolResultRow) => {
    setEditing(row);
    setForm({
      primaryReading: primaryReading(row),
      measurementDeviceId: row.measurementDeviceId || valueOf(row, ['measurementDeviceId']),
      measurementPlace: valueOf(row, ['measurementPlace', 'samplingPlace']),
      sourceNumber: valueOf(row, ['sourceNumber']),
      readings: valueOf(row, ['readings', 'measurementReadings']),
      externalLaboratory: valueOf(row, ['externalLaboratory']),
      externalLaboratoryDocument: valueOf(row, ['externalLaboratoryDocument']),
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!form.primaryReading.trim() && !form.readings.trim()) return onNotify('Введите первичные показания', 'warning');
    setSaving(true);
    try {
      const saved = await protocolService.updateProtocolResult(protocolId, editing.id, {
        measurementDeviceId: form.measurementDeviceId || undefined,
        normativeId: valueOf(editing, ['normativeId']) || editing.normativeReference?.id,
        values: {
          ...editing.values,
          primaryReading: form.primaryReading,
          readings: form.readings,
          measurementReadings: form.readings || form.primaryReading,
          measurementDeviceId: form.measurementDeviceId,
          measurementPlace: form.measurementPlace,
          samplingPlace: form.measurementPlace,
          sourceNumber: form.sourceNumber,
          externalLaboratory: form.externalLaboratory,
          externalLaboratoryDocument: form.externalLaboratoryDocument,
        },
      });
      onChange(rows.map((row) => row.id === editing.id ? saved : row));
      setEditing(null);
      onNotify('Первичные показания сохранены', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось сохранить показания', 'error');
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async (row: ProtocolResultRow) => {
    setSaving(true);
    try {
      const saved = await protocolService.addProtocolResult(protocolId, {
        measurementDeviceId: row.measurementDeviceId,
        normativeId: row.normativeReference?.id || valueOf(row, ['normativeId']),
        values: { ...row.values, primaryReading: '', result: '', resultMg: '', resultValue: '' },
      });
      onChange([...rows, saved]);
      onNotify('Строка дублирована', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось дублировать строку', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteRow) return;
    try {
      await protocolService.deleteProtocolResult(protocolId, deleteRow.id);
      onChange(rows.filter((item) => item.id !== deleteRow.id));
      setDeleteRow(null);
      onNotify('Строка удалена', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось удалить строку', 'error');
    }
  };

  const removeSelected = async () => {
    if (!selectedRows.length) return onNotify('Выберите строки', 'warning');
    if (!window.confirm(`Удалить выбранные строки: ${selectedRows.length}?`)) return;
    setSaving(true);
    try {
      await Promise.all(selectedRows.map((row) => protocolService.deleteProtocolResult(protocolId, row.id)));
      const selectedSet = new Set(selectedRows.map((row) => row.id));
      onChange(rows.filter((row) => !selectedSet.has(row.id)));
      setSelected([]);
      onNotify('Выбранные строки удалены', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось удалить выбранные строки', 'error');
    } finally {
      setSaving(false);
    }
  };

  const applyToSelected = async (patch: Record<string, string>) => {
    if (!selectedRows.length) return onNotify('Выберите строки', 'warning');
    setSaving(true);
    try {
      const saved = await Promise.all(selectedRows.map((row) => protocolService.updateProtocolResult(protocolId, row.id, {
        measurementDeviceId: patch.measurementDeviceId || row.measurementDeviceId,
        normativeId: row.normativeReference?.id || valueOf(row, ['normativeId']),
        values: { ...row.values, ...patch },
      })));
      const map = new Map(saved.map((row) => [row.id, row]));
      onChange(rows.map((row) => map.get(row.id) || row));
      onNotify('Значение применено к выбранным строкам', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Массовое изменение не выполнено', 'error');
    } finally {
      setSaving(false);
    }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    try {
      await protocolService.importExcel(protocolId, file);
      await onImported();
      onNotify('Показания импортированы из Excel', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось импортировать Excel', 'error');
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const applyCalculatedRow = async (row?: ProtocolResultRow) => {
    if (row?.id) {
      onChange(rows.map((item) => item.id === row.id ? row : item));
    }
  };

  const calculateRow = async (row: ProtocolResultRow) => {
    setSaving(true);
    try {
      await protocolService.calculateResult(protocolId, row.id);
      await onImported();
      onNotify('Результат рассчитан', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось рассчитать строку', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openCalculationHistory = async (row: ProtocolResultRow) => {
    setSaving(true);
    setRowMenuId(null);
    try {
      const history = await protocolService.getCalculationHistory(protocolId, row.id);
      setCalculationHistory(history);
      if (!history.length) onNotify('История расчета пуста', 'info');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось загрузить историю расчета', 'error');
    } finally {
      setSaving(false);
    }
  };

  const calculateAll = async () => {
    setSaving(true);
    try {
      const summary = await protocolService.calculateProtocolSummary(protocolId);
      setCalculationSummary(summary);
      const rowMap = new Map(summary.rows.filter((item) => item.row?.id).map((item) => [item.row!.id, item.row!]));
      if (rowMap.size) onChange(rows.map((row) => rowMap.get(row.id) || row));
      await onImported();
      onNotify('Результаты рассчитаны', summary.errors || summary.waitingInputs ? 'warning' : 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось рассчитать результаты', 'error');
      await onCheckNormatives();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Результаты испытаний</h2>
          <p className="mt-1 text-sm text-slate-500">Добавьте показатели, введите показания и запустите расчет результатов.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => importFile(event.target.files?.[0])} />
          <Button type="button" variant="secondary" disabled={readOnly || busy || saving} onClick={addBulk}><Plus className="h-4 w-4" /> Добавить показатель</Button>
          <Button type="button" variant="secondary" disabled={readOnly || busy || saving} onClick={() => fileRef.current?.click()}><FileSpreadsheet className="h-4 w-4" /> Импорт из Excel</Button>
          <Button type="button" disabled={busy || saving || !rows.length} onClick={calculateAll}><Calculator className="h-4 w-4" /> Рассчитать результаты</Button>
        </div>
      </div>

      {calculationSummary && <div className="mb-4 grid gap-2 rounded-xl border border-eco-100 bg-eco-50 p-3 text-sm sm:grid-cols-3 xl:grid-cols-6">
        <div><span className="text-slate-500">Всего</span><p className="font-black text-slate-900">{calculationSummary.total}</p></div>
        <div><span className="text-slate-500">Рассчитано</span><p className="font-black text-slate-900">{calculationSummary.calculated}</p></div>
        <div><span className="text-slate-500">Ручной ввод</span><p className="font-black text-slate-900">{calculationSummary.manual}</p></div>
        <div><span className="text-slate-500">Ошибки</span><p className="font-black text-slate-900">{calculationSummary.errors}</p></div>
        <div><span className="text-slate-500">Повторный анализ</span><p className="font-black text-slate-900">{calculationSummary.needsRepeat}</p></div>
        <div><span className="text-slate-500">Не соответствует</span><p className="font-black text-slate-900">{calculationSummary.exceeded}</p></div>
      </div>}

      {!readOnly && <div className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input value={query} onChange={(event) => search(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addBulk(); } }} placeholder="Код или название вещества; массово: 0301, 0304, 0330, 0337" className={`${inputClass} pl-10`} />
          {suggestions.length > 0 && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            {suggestions.map((item) => <button key={`${item.code}-${item.id || item.name}`} type="button" onClick={() => addPollutant(item)} className="flex w-full flex-wrap gap-x-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-eco-50">
              <span className="font-black text-eco-800">{item.code}</span><span className="font-bold">{item.name}</span><span className="text-slate-500">{item.formula}</span><span className="text-slate-500">{item.cas}</span>
            </button>)}
          </div>}
        </div>
        {selectedRows.length > 0 && <div className="grid gap-2 rounded-xl border border-eco-100 bg-white p-3 lg:grid-cols-[1fr_auto_1fr_auto_auto]">
          <select value={bulkDeviceId} onChange={(event) => setBulkDeviceId(event.target.value)} className={inputClass}><option value="">Прибор для выбранных строк</option>{devices.map((item) => <option key={item.deviceId} value={item.deviceId}>{item.deviceSnapshot.name} · {item.deviceSnapshot.serialNumber}</option>)}</select>
          <Button type="button" variant="secondary" disabled={!bulkDeviceId || saving} onClick={() => applyToSelected({ measurementDeviceId: bulkDeviceId })}>Применить прибор</Button>
          <input value={bulkPlace} onChange={(event) => setBulkPlace(event.target.value)} placeholder="Одно место замера" className={inputClass} />
          <Button type="button" variant="secondary" disabled={!bulkPlace || saving} onClick={() => applyToSelected({ measurementPlace: bulkPlace, samplingPlace: bulkPlace })}>Применить место</Button>
          <Button type="button" variant="secondary" className="text-rose-700 hover:bg-rose-50" disabled={saving} onClick={removeSelected}>Удалить выбранные</Button>
        </div>}
      </div>}

      <div className="overflow-x-auto">
        <table className="min-w-[1320px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
            {!readOnly && <th className="px-3 py-3"><input type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} /></th>}
            <th className="px-3 py-3">Код</th><th className="px-3 py-3">Показатель</th><th className="px-3 py-3">Методика</th><th className="px-3 py-3">Сырые данные</th><th className="px-3 py-3">Прибор</th><th className="bg-slate-100 px-3 py-3">Результат</th><th className="bg-slate-100 px-3 py-3">Погрешность</th><th className="bg-slate-100 px-3 py-3">Норматив</th><th className="bg-slate-100 px-3 py-3">Статус</th><th className="px-3 py-3 text-right">Действия</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((row) => {
            const calculationLabel = calculationStatusLabel(row.calculationStatus || valueOf(row, ['calculationStatus']));
            return <tr key={row.id} className="align-top hover:bg-slate-50">
              {!readOnly && <td className="px-3 py-3"><input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /></td>}
              <td className="px-3 py-3 font-black text-eco-800">{pollutantCode(row) || '—'}</td>
              <td className="px-3 py-3"><p className="font-bold text-slate-900">{indicator(row) || '—'}</p>{advanced && <p className="mt-1 text-xs text-slate-500">{valueOf(row, ['formula'])} {valueOf(row, ['cas'])}</p>}</td>
              <td className="px-3 py-3"><div className="max-w-60"><p className="font-semibold text-slate-800">{testingMethod(row) || '—'}</p>{measurementPlace(row) && <p className="mt-1 text-xs text-slate-500">{measurementPlace(row)}</p>}{row.sampleName && <p className="mt-1 text-xs text-slate-500">{row.sampleName}</p>}</div></td>
              <td className="px-3 py-3"><button type="button" disabled={readOnly} onClick={() => setRawRow(row)} className="min-w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-eco-800 disabled:cursor-default">{rawDataLabel(row) || 'Ввести данные'}</button></td>
              <td className="px-3 py-3">{resolveDeviceName(row, devices) || '—'}</td>
              <td className="bg-slate-50 px-3 py-3"><div className={automaticClass}>{officialResult(row, templateId) || 'Ожидает расчёта'} {officialResult(row, templateId) && unit(row)}</div></td>
              <td className="bg-slate-50 px-3 py-3"><div className={automaticClass}>{uncertaintyValue(row) || '—'}</div></td>
              <td className="bg-slate-50 px-3 py-3"><div className={automaticClass}>{normativeValue(row) ? `${normativeValue(row)} ${unit(row)}` : 'Норматив не найден'}</div></td>
              <td className="bg-slate-50 px-3 py-3"><div className="space-y-2"><NormativeStatusBadge status={statusOf(row)} />{calculationLabel && <p className="text-xs font-semibold text-slate-600">{calculationLabel}</p>}{exceededText(row, templateId) && <p className="max-w-56 text-xs font-semibold text-rose-700">{exceededText(row, templateId)}</p>}</div></td>
              <td className="px-3 py-3"><div className="relative flex flex-wrap justify-end gap-1">
                <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} onClick={() => setRawRow(row)}>Ввести данные</Button>
                <Button type="button" variant="secondary" className="px-3" disabled={saving} onClick={() => calculateRow(row)}>Рассчитать</Button>
                <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} title="Изменить" onClick={() => openEdit(row)}>Изменить</Button>
                <Button type="button" variant="secondary" className="px-2.5" disabled={saving} title="Еще" onClick={() => setRowMenuId((current) => current === row.id ? null : row.id)}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
                {rowMenuId === row.id && (
                  <div className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl">
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400" disabled={readOnly || saving} onClick={() => { setRowMenuId(null); duplicate(row); }}>
                      <Copy className="h-4 w-4" /> Дублировать
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" disabled={saving} onClick={() => openCalculationHistory(row)}>
                      <History className="h-4 w-4" /> История расчета
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400" disabled={readOnly || saving} onClick={() => { setRowMenuId(null); setDeleteRow(row); }}>
                      <Trash2 className="h-4 w-4" /> Удалить
                    </button>
                  </div>
                )}
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {!rows.length && <div className="border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">Показания ещё не добавлены.</div>}
      {reviewRow && <div className="mt-3 inline-block max-w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <button type="button" onClick={() => setExtraActionsOpen((value) => !value)} className="text-sm font-bold text-amber-900">
          Дополнительные действия
        </button>
        {extraActionsOpen && <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setCalculation({ row: reviewRow, details: reviewRow.calculationDetails || {} })}>Проверить расчет</Button>
          <Button type="button" variant="secondary" disabled={readOnly} onClick={() => openEdit(reviewRow)}>Исправить исходные данные</Button>
          <Button type="button" variant="secondary" disabled={readOnly || saving} onClick={() => duplicate(reviewRow)}>Добавить повторный замер</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={async () => {
            try {
              await protocolService.readyForApproval(protocolId);
              await onImported();
              onNotify('Протокол отправлен на проверку', 'success');
            } catch (error) {
              onNotify(error instanceof Error ? error.message : 'Не удалось отправить на проверку', 'error');
            }
          }}>Отправить на проверку</Button>
        </div>}
      </div>}
      {canUseAdvanced && <button type="button" onClick={() => setAdvanced((value) => !value)} className="mt-4 text-sm font-bold text-eco-700">{advanced ? 'Скрыть расширенные данные' : 'Расширенный режим'}</button>}

      <RawMeasurementsModal
        open={Boolean(rawRow)}
        protocolId={protocolId}
        row={rawRow}
        devices={devices}
        onClose={() => setRawRow(null)}
        onCalculated={applyCalculatedRow}
        onReload={onImported}
        onNotify={onNotify}
      />

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Первичные показания" description="Официальный результат будет рассчитан backend после сохранения." size="lg" loading={saving}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-bold text-slate-700">Показание / концентрация<input autoFocus value={form.primaryReading || ''} onChange={(event) => setForm({ ...form, primaryReading: event.target.value })} className={inputClass} /></label>
          <label className="space-y-1.5 text-sm font-bold text-slate-700">Серия показаний<textarea rows={2} value={form.readings || ''} onChange={(event) => setForm({ ...form, readings: event.target.value })} placeholder="Через запятую: 418, 421, 416" className={inputClass} /></label>
          <label className="space-y-1.5 text-sm font-bold text-slate-700">Прибор<select value={form.measurementDeviceId || ''} onChange={(event) => setForm({ ...form, measurementDeviceId: event.target.value })} className={inputClass}><option value="">Не выбран</option>{devices.map((item) => <option key={item.deviceId} value={item.deviceId}>{item.deviceSnapshot.name} · {item.deviceSnapshot.serialNumber}</option>)}</select></label>
          <label className="space-y-1.5 text-sm font-bold text-slate-700">Место замера<input value={form.measurementPlace || ''} onChange={(event) => setForm({ ...form, measurementPlace: event.target.value })} className={inputClass} /></label>
          {templateId === 'industrial_emissions' && <label className="space-y-1.5 text-sm font-bold text-slate-700">Источник<input value={form.sourceNumber || ''} onChange={(event) => setForm({ ...form, sourceNumber: event.target.value })} className={inputClass} /></label>}
          {(templateId === 'water_wastewater' || templateId === 'soil') && <>
            <label className="space-y-1.5 text-sm font-bold text-slate-700">Внешняя лаборатория<input value={form.externalLaboratory || ''} onChange={(event) => setForm({ ...form, externalLaboratory: event.target.value })} className={inputClass} /></label>
            <label className="space-y-1.5 text-sm font-bold text-slate-700">Документ внешней лаборатории<input value={form.externalLaboratoryDocument || ''} onChange={(event) => setForm({ ...form, externalLaboratoryDocument: event.target.value })} className={inputClass} /></label>
          </>}
        </div>
        <div className="mt-5 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Отмена</Button><Button type="button" onClick={save} disabled={saving}>Сохранить показания</Button></div>
      </Modal>

      <Modal open={Boolean(calculation)} onClose={() => setCalculation(null)} title="Расчёт результата" size="lg">
        {calculation && <dl className="grid gap-3 sm:grid-cols-2">
          {[
            ['Исходные показания', primaryReading(calculation.row) || '—'],
            ['Формула', calculation.details.formula || 'Backend не передал формулу'],
            ['Подставленные числа', calculation.details.substitutedValues || '—'],
            ['Округление', calculation.details.rounding || '—'],
            ['Итог', calculation.details.finalValue || officialResult(calculation.row, templateId) || '—'],
            ['Норматив', calculation.details.normativeValue || normativeValue(calculation.row) || 'Не найден'],
            ['Сравнение', calculation.details.comparisonResult || String(calculation.row.internalStatus || calculation.row.checkStatus || '—')],
            ['Версия методики', calculation.details.methodVersion || valueOf(calculation.row, ['methodVersion']) || '—'],
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-400">{label}</dt><dd className="mt-1 whitespace-pre-wrap font-semibold text-slate-800">{value}</dd></div>)}
          {calculation.details.intermediateResults?.length ? <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2"><dt className="text-xs font-bold uppercase text-slate-400">Промежуточные результаты</dt>{calculation.details.intermediateResults.map((item) => <dd key={item.label} className="mt-1 font-semibold">{item.label}: {item.value}</dd>)}</div> : null}
        </dl>}
      </Modal>

      <Modal open={calculationHistory !== null} onClose={() => setCalculationHistory(null)} title="История расчета" size="lg">
        <div className="space-y-3">
          {calculationHistory?.length ? calculationHistory.map((item, index) => (
            <div key={`${item.resultId}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-900">Расчет {index + 1}</p>
                <p className="text-xs font-semibold text-slate-500">{calculationStatusLabel(item.calculationStatus)}</p>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div><dt className="text-xs font-bold uppercase text-slate-400">Результат</dt><dd className="font-semibold text-slate-800">{item.result ?? '—'}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Норматив</dt><dd className="font-semibold text-slate-800">{item.normativeValue ?? 'Норматив не найден'}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Статус</dt><dd className="font-semibold text-slate-800"><NormativeStatusBadge status={item.internalStatus} /></dd></div>
              </dl>
              {item.calculationMessage && <p className="mt-2 text-sm text-slate-600">{item.calculationMessage}</p>}
            </div>
          )) : <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">История расчета пуста.</p>}
        </div>
      </Modal>

      <Modal open={Boolean(deleteRow)} onClose={() => setDeleteRow(null)} title="Удалить строку?" size="sm">
        <p className="text-sm text-slate-600">Будут удалены первичные показания и связанный расчёт. Это действие нельзя отменить.</p>
        <div className="mt-5 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setDeleteRow(null)}>Отмена</Button><Button type="button" onClick={remove}>Удалить</Button></div>
      </Modal>
    </section>
  );
};

export default ProtocolResultsTable;
