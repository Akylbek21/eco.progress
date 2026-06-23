import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Copy, FileSpreadsheet, Plus, Save, SearchCheck, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import NormativeStatusBadge from './NormativeStatusBadge';
import { importExcel, searchNormative } from '../../services/protocolService';
import { protocolResultColumns } from '../../data/protocolTemplates';
import type { NormativeRecord, ProtocolResultRow, ProtocolTemplateId } from '../../types/protocols';

type Props = {
  protocolId: string;
  templateId: ProtocolTemplateId;
  rows: ProtocolResultRow[];
  readOnly: boolean;
  busy?: boolean;
  testingDate?: string;
  onChange: (rows: ProtocolResultRow[]) => void;
  onSave: () => void | Promise<void>;
  onCheckNormatives: () => void | Promise<void>;
  onImported: () => void | Promise<void>;
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
};

const inputClass = 'min-w-[150px] rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';

const emptyRow = (): ProtocolResultRow => ({
  id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  internalStatus: 'EMPTY_RESULT',
  checkStatus: 'EMPTY_RESULT',
  values: {},
});

const ProtocolResultsTable = ({ protocolId, templateId, rows, readOnly, busy = false, testingDate = '', onChange, onSave, onCheckNormatives, onImported, onNotify }: Props) => {
  const [importing, setImporting] = useState(false);
  const [normativeChoice, setNormativeChoice] = useState<{ rowIndex: number; items: NormativeRecord[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rowsRef = useRef(rows);
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const columns = protocolResultColumns[templateId] || [];

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => () => {
    Object.values(debounceTimers.current).forEach(clearTimeout);
  }, []);

  const applyNormative = (rowIndex: number, normative: NormativeRecord) => {
    const currentRows = rowsRef.current;
    const nextRows = currentRows.map((row, index) => index === rowIndex ? {
      ...row,
      internalStatus: 'NEEDS_REVIEW' as const,
      checkStatus: 'NEEDS_REVIEW' as const,
      values: {
        ...row.values,
        unit: row.values.unit || normative.unit,
        normative: row.values.normative || normative.value || normative.max || normative.min,
        testingMethod: row.values.testingMethod || normative.testingMethod,
        samplingMethod: row.values.samplingMethod || normative.samplingMethod,
        normativeDocument: row.values.normativeDocument || normative.normativeDocument,
      },
    } : row);
    rowsRef.current = nextRows;
    onChange(nextRows);
    setNormativeChoice(null);
  };

  const findNormative = async (rowIndex: number) => {
    const row = rowsRef.current[rowIndex];
    const indicator = String(row?.values?.indicator || '').trim();
    if (!indicator) return;
    try {
      const result = await searchNormative({
        templateId,
        indicator,
        objectType: String(row.values.objectType || row.values.object || row.values.samplingPlace || ''),
        unit: String(row.values.unit || ''),
        testingDate,
      });
      const candidates = result.normatives || result.items || (result.normative ? [result.normative] : []);
      if (result.ambiguous || candidates.length > 1) {
        setNormativeChoice({ rowIndex, items: candidates });
        return;
      }
      if (!result.found || candidates.length === 0) {
        const currentRows = rowsRef.current;
        const nextRows = currentRows.map((item, index) => index === rowIndex ? { ...item, internalStatus: 'NORMATIVE_NOT_FOUND' as const, checkStatus: 'NORMATIVE_NOT_FOUND' as const } : item);
        rowsRef.current = nextRows;
        onChange(nextRows);
        onNotify('Норматив не найден. Заполните вручную или добавьте норматив в справочник', 'warning');
        return;
      }
      applyNormative(rowIndex, candidates[0]);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось найти норматив', 'error');
    }
  };

  const updateCell = (rowIndex: number, key: string, value: string) => {
    const nextRows = rows.map((row, index) => index === rowIndex ? {
      ...row,
      values: { ...row.values, [key]: value },
    } : row);
    rowsRef.current = nextRows;
    onChange(nextRows);

    if (!['indicator', 'objectType', 'object', 'samplingPlace', 'unit'].includes(key)) return;
    clearTimeout(debounceTimers.current[rowIndex]);
    debounceTimers.current[rowIndex] = setTimeout(() => findNormative(rowIndex), 450);
  };

  const addRow = () => onChange([...rows, emptyRow()]);
  const deleteRow = (rowIndex: number) => onChange(rows.filter((_, index) => index !== rowIndex));
  const copyRow = (rowIndex: number) => onChange([
    ...rows.slice(0, rowIndex + 1),
    { ...rows[rowIndex], id: `local-${Date.now()}`, values: { ...rows[rowIndex].values } },
    ...rows.slice(rowIndex + 1),
  ]);

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
          <h2 className="text-lg font-bold text-slate-900">Результаты замеров</h2>
          <p className="mt-1 text-sm text-slate-500">Статус проверки выставляется после кнопки «Проверить нормативы».</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={readOnly || busy} onClick={addRow}><Plus className="h-4 w-4" /> Добавить строку</Button>
          <Button type="button" variant="secondary" disabled={readOnly || busy || importing} onClick={() => fileInputRef.current?.click()}><FileSpreadsheet className="h-4 w-4" /> {importing ? 'Импорт...' : 'Импорт из Excel'}</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={onCheckNormatives}><SearchCheck className="h-4 w-4" /> Проверить нормативы</Button>
          <Button type="button" disabled={readOnly || busy} onClick={onSave}><Save className="h-4 w-4" /> {busy ? 'Сохранение...' : 'Сохранить'}</Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth: `${Math.max(900, columns.length * 180 + 220)}px` }}>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => <th key={column.key} className="px-3 py-3">{column.label}</th>)}
              <th className="px-3 py-3">Статус проверки</th>
              <th className="px-3 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3 align-top">
                    <input
                      className={inputClass}
                      disabled={readOnly}
                      type={column.type || 'text'}
                      required={column.required}
                      value={String(row.values?.[column.key] ?? '')}
                      onChange={(event) => updateCell(rowIndex, column.key, event.target.value)}
                    />
                  </td>
                ))}
                <td className="px-3 py-3 align-top"><NormativeStatusBadge status={row.checkStatus || row.internalStatus} /></td>
                <td className="px-3 py-3 align-top">
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" className="px-3" disabled={readOnly || busy} title="Копировать строку" onClick={() => copyRow(rowIndex)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="secondary" className="px-3 text-rose-700 hover:bg-rose-50" disabled={readOnly || busy} title="Удалить строку" onClick={() => deleteRow(rowIndex)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
          <p className="text-sm text-slate-600">Найдено несколько подходящих нормативов. Автоматический выбор отключён.</p>
          {normativeChoice?.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-eco-400 hover:bg-eco-50"
              onClick={() => applyNormative(normativeChoice.rowIndex, item)}
            >
              <span className="block font-bold text-slate-900">{item.indicator} · {item.value || item.max || item.min || 'информационный'}</span>
              <span className="mt-1 block text-sm text-slate-600">{item.researchObject || 'Объект не указан'} · {item.unit || 'без единицы'}</span>
              <span className="mt-1 block text-xs font-semibold text-slate-500">{item.normativeDocument || 'Документ не указан'}</span>
            </button>
          ))}
          {normativeChoice?.items.length === 0 && <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Backend сообщил о неоднозначном поиске, но не вернул варианты.</p>}
        </div>
      </Modal>
    </section>
  );
};

export default ProtocolResultsTable;
