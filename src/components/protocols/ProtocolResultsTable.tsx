import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, FileSpreadsheet, Plus, Save, SearchCheck, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import NormativeStatusBadge from './NormativeStatusBadge';
import {
  addProtocolResult,
  deleteProtocolResult,
  importExcel,
  searchNormative,
  updateProtocolResult,
} from '../../services/protocolService';
import { getProtocolResultColumns } from '../../data/protocolTemplates';
import type {
  NormativeRecord,
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

const inputClass = 'min-w-[150px] rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';
let draftSequence = 0;
const createDraft = (values: ProtocolResultRow['values'] = {}): ProtocolResultRow => ({
  id: `draft-${++draftSequence}`,
  internalStatus: 'EMPTY_RESULT',
  checkStatus: 'EMPTY_RESULT',
  values,
});
const isDraft = (row: ProtocolResultRow) => row.id.startsWith('draft-');

const toPayload = (row: ProtocolResultRow): ProtocolResultPayload => ({
  values: { ...row.values },
  measurementDeviceId: String(row.values.measurementDeviceId || row.measurementDeviceId || '') || undefined,
  normativeId: String(row.values.normativeId || '') || undefined,
});

const ProtocolResultsTable = ({
  protocolId,
  templateId,
  subtype,
  rows,
  devices = [],
  readOnly,
  busy = false,
  testingDate = '',
  onChange,
  onCheckNormatives,
  onImported,
  onNotify,
}: Props) => {
  const [savingRowId, setSavingRowId] = useState('');
  const [importing, setImporting] = useState(false);
  const [normativeChoice, setNormativeChoice] = useState<{ rowId: string; items: NormativeRecord[] } | null>(null);
  const rowsRef = useRef(rows);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const columns = useMemo(() => getProtocolResultColumns(templateId, subtype), [templateId, subtype]);

  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => () => Object.values(debounceTimers.current).forEach(clearTimeout), []);

  const replaceRow = (rowId: string, next: ProtocolResultRow) => {
    const updated = rowsRef.current.map((row) => row.id === rowId ? next : row);
    rowsRef.current = updated;
    onChange(updated);
  };

  const applyNormative = (rowId: string, normative: NormativeRecord) => {
    const row = rowsRef.current.find((item) => item.id === rowId);
    if (!row) return;
    replaceRow(rowId, {
      ...row,
      values: {
        ...row.values,
        normativeId: normative.id,
        unit: normative.unit,
        normative: normative.value,
        normativeMin: normative.min,
        normativeMax: normative.max,
        comparisonType: normative.comparisonType,
        normativeDocument: normative.normativeDocument,
        testingMethod: normative.testingMethod,
        testingMethodDocument: normative.testingMethod,
        samplingMethod: normative.samplingMethod,
      },
    });
    setNormativeChoice(null);
  };

  const findNormative = async (rowId: string) => {
    const row = rowsRef.current.find((item) => item.id === rowId);
    const indicator = String(row?.values.indicator || '').trim();
    if (!row || !indicator) return;
    try {
      const result = await searchNormative({
        templateId,
        subtype: subtype || '',
        indicator,
        objectType: String(row.values.objectType || row.values.object || row.values.samplingPlace || row.values.measurementPlace || ''),
        unit: String(row.values.unit || ''),
        testingDate,
      });
      const candidates = result.normatives || result.items || (result.normative ? [result.normative] : []);
      if (result.ambiguous || candidates.length > 1) {
        setNormativeChoice({ rowId, items: candidates });
      } else if (candidates.length === 1) {
        applyNormative(rowId, candidates[0]);
      } else {
        onNotify('Норматив не найден. Статус проверки установит backend после сохранения результата.', 'warning');
      }
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось найти норматив', 'error');
    }
  };

  const updateCell = (rowId: string, key: string, value: string) => {
    const row = rowsRef.current.find((item) => item.id === rowId);
    if (!row) return;
    replaceRow(rowId, { ...row, values: { ...row.values, [key]: value } });
    if (!['indicator', 'objectType', 'object', 'samplingPlace', 'measurementPlace', 'unit'].includes(key)) return;
    clearTimeout(debounceTimers.current[rowId]);
    debounceTimers.current[rowId] = setTimeout(() => findNormative(rowId), 500);
  };

  const saveRow = async (row: ProtocolResultRow) => {
    const missing = columns.find((column) => column.required && !String(row.values[column.key] || '').trim());
    if (missing) return onNotify(`Заполните поле «${missing.label}».`, 'warning');
    setSavingRowId(row.id);
    try {
      const saved = isDraft(row)
        ? await addProtocolResult(protocolId, toPayload(row))
        : await updateProtocolResult(protocolId, row.id, toPayload(row));
      replaceRow(row.id, saved);
      onNotify(isDraft(row) ? 'Результат добавлен' : 'Результат обновлён', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось сохранить результат', 'error');
    } finally {
      setSavingRowId('');
    }
  };

  const removeRow = async (row: ProtocolResultRow) => {
    if (!window.confirm('Удалить строку результата?')) return;
    if (!isDraft(row)) {
      setSavingRowId(row.id);
      try {
        await deleteProtocolResult(protocolId, row.id);
        onNotify('Результат удалён', 'success');
      } catch (error) {
        onNotify(error instanceof Error ? error.message : 'Не удалось удалить результат', 'error');
        setSavingRowId('');
        return;
      }
    }
    const updated = rowsRef.current.filter((item) => item.id !== row.id);
    rowsRef.current = updated;
    onChange(updated);
    setSavingRowId('');
  };

  const copyRow = (row: ProtocolResultRow) => {
    const index = rowsRef.current.findIndex((item) => item.id === row.id);
    const updated = [...rowsRef.current];
    updated.splice(index + 1, 0, createDraft({ ...row.values }));
    rowsRef.current = updated;
    onChange(updated);
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      await importExcel(protocolId, file);
      await onImported();
      onNotify('Данные импортированы из Excel', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось импортировать Excel', 'error');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Результаты измерений</h2>
          <p className="mt-1 text-sm text-slate-500">Каждая строка создаётся и обновляется отдельным backend-запросом. Нормативный статус рассчитывает только backend.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={readOnly || busy} onClick={() => onChange([...rowsRef.current, createDraft()])}><Plus className="h-4 w-4" /> Добавить строку</Button>
          <Button type="button" variant="secondary" disabled={readOnly || busy || importing} onClick={() => fileInputRef.current?.click()}><FileSpreadsheet className="h-4 w-4" /> {importing ? 'Импорт…' : 'Импорт Excel'}</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={onCheckNormatives}><SearchCheck className="h-4 w-4" /> Проверить нормативы</Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth: `${Math.max(980, columns.length * 175 + 230)}px` }}>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => <th key={column.key} className="px-3 py-3">{column.label}</th>)}
              <th className="px-3 py-3">Статус</th>
              <th className="px-3 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3 align-top">
                    {column.type === 'device' ? (
                      <select className={inputClass} disabled={readOnly} value={String(row.values[column.key] || '')} onChange={(event) => updateCell(row.id, column.key, event.target.value)}>
                        <option value="">Не выбран</option>
                        {devices.map((item) => (
                          <option key={item.deviceId} value={item.deviceId} disabled={['ARCHIVED', 'EXPIRED'].includes(item.deviceSnapshot.status)}>
                            {item.deviceSnapshot.name} · {item.deviceSnapshot.model} · {item.deviceSnapshot.serialNumber}{item.deviceSnapshot.status === 'EXPIRING' ? ' (поверка скоро истекает)' : ''}
                          </option>
                        ))}
                      </select>
                    ) : column.type === 'select' ? (
                      <select className={inputClass} disabled={readOnly} required={column.required} value={String(row.values[column.key] || '')} onChange={(event) => updateCell(row.id, column.key, event.target.value)}>
                        <option value="">Выберите</option>
                        {column.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : (
                      <input
                        className={inputClass}
                        disabled={readOnly}
                        type={column.type === 'indicator' ? 'text' : column.type || 'text'}
                        step={column.type === 'number' ? 'any' : undefined}
                        required={column.required}
                        value={String(row.values[column.key] ?? '')}
                        onChange={(event) => updateCell(row.id, column.key, event.target.value)}
                        onBlur={() => column.key === 'indicator' && findNormative(row.id)}
                      />
                    )}
                  </td>
                ))}
                <td className="px-3 py-3 align-top"><NormativeStatusBadge status={row.internalStatus || row.checkStatus} /></td>
                <td className="px-3 py-3 align-top">
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" className="px-3" disabled={readOnly || busy} title="Копировать" onClick={() => copyRow(row)}><Copy className="h-4 w-4" /></Button>
                    <Button type="button" variant="secondary" className="px-3" disabled={readOnly || busy || savingRowId === row.id} title="Сохранить строку" onClick={() => saveRow(row)}><Save className="h-4 w-4" /></Button>
                    <Button type="button" variant="secondary" className="px-3 text-rose-700 hover:bg-rose-50" disabled={readOnly || busy || savingRowId === row.id} title="Удалить" onClick={() => removeRow(row)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">Нет строк результатов.</div>}

      <Modal open={Boolean(normativeChoice)} onClose={() => setNormativeChoice(null)} title="Выберите норматив" size="lg">
        <div className="space-y-3">
          {normativeChoice?.items.map((item) => (
            <button key={item.id} type="button" className="w-full rounded-xl border border-slate-200 p-3 text-left hover:border-eco-400 hover:bg-eco-50" onClick={() => applyNormative(normativeChoice.rowId, item)}>
              <span className="block font-bold text-slate-900">{item.indicator} · {item.value || item.max || item.min || 'информационный'}</span>
              <span className="mt-1 block text-sm text-slate-600">{item.unit || 'без единицы'} · {item.comparisonType}</span>
              <span className="mt-1 block break-words text-xs font-semibold text-slate-500">{item.normativeDocument || 'Документ не указан'}</span>
            </button>
          ))}
        </div>
      </Modal>
    </section>
  );
};

export default ProtocolResultsTable;
