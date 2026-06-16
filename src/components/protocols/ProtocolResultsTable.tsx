import { ChangeEvent, useRef, useState } from 'react';
import { Copy, FileSpreadsheet, Plus, Save, SearchCheck, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import NormativeStatusBadge from './NormativeStatusBadge';
import { importExcel, searchNormative } from '../../services/protocolService';
import type { ProtocolResultRow, ProtocolTemplateId } from '../../types/protocols';

type Props = {
  protocolId: string;
  templateId: ProtocolTemplateId;
  rows: ProtocolResultRow[];
  readOnly: boolean;
  onChange: (rows: ProtocolResultRow[]) => void;
  onSave: () => void | Promise<void>;
  onCheckNormatives: () => void | Promise<void>;
  onImported: () => void | Promise<void>;
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
};

const inputClass = 'min-w-[150px] rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';

const columns = [
  { key: 'samplingPoint', label: 'Точка / место отбора' },
  { key: 'indicator', label: 'Показатель' },
  { key: 'unit', label: 'Единица' },
  { key: 'result', label: 'Результат' },
  { key: 'normative', label: 'Норматив' },
  { key: 'testingMethod', label: 'Метод испытаний' },
  { key: 'samplingMethod', label: 'Метод отбора' },
  { key: 'normativeDocument', label: 'Нормативный документ' },
  { key: 'comment', label: 'Комментарий' },
] as const;

const emptyRow = (): ProtocolResultRow => ({
  id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  internalStatus: 'EMPTY_RESULT',
  checkStatus: 'EMPTY_RESULT',
  values: {},
});

const ProtocolResultsTable = ({ protocolId, templateId, rows, readOnly, onChange, onSave, onCheckNormatives, onImported, onNotify }: Props) => {
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateCell = async (rowIndex: number, key: string, value: string) => {
    const nextRows = rows.map((row, index) => index === rowIndex ? {
      ...row,
      [key]: value,
      values: { ...row.values, [key]: value },
    } : row);
    onChange(nextRows);

    if (key !== 'indicator' || !value.trim()) return;
    try {
      const result = await searchNormative({ templateId, indicator: value.trim() });
      if (!result.found || !result.normative) {
        onChange(nextRows.map((row, index) => index === rowIndex ? { ...row, internalStatus: 'NORMATIVE_NOT_FOUND', checkStatus: 'NORMATIVE_NOT_FOUND' } : row));
        onNotify('Норматив не найден. Заполните вручную или добавьте норматив в справочник', 'warning');
        return;
      }
      const normative = result.normative;
      onChange(nextRows.map((row, index) => index === rowIndex ? {
        ...row,
        unit: row.unit || normative.unit,
        normative: row.normative || normative.value || normative.max || normative.min,
        testingMethod: row.testingMethod || normative.testingMethod,
        samplingMethod: row.samplingMethod || normative.samplingMethod,
        normativeDocument: row.normativeDocument || normative.normativeDocument,
        values: {
          ...row.values,
          unit: row.values.unit || normative.unit,
          normative: row.values.normative || normative.value || normative.max || normative.min,
          testingMethod: row.values.testingMethod || normative.testingMethod,
          samplingMethod: row.values.samplingMethod || normative.samplingMethod,
          normativeDocument: row.values.normativeDocument || normative.normativeDocument,
        },
      } : row));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось найти норматив', 'error');
    }
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
          <Button type="button" variant="secondary" disabled={readOnly} onClick={addRow}><Plus className="h-4 w-4" /> Добавить строку</Button>
          <Button type="button" variant="secondary" disabled={readOnly} onClick={() => fileInputRef.current?.click()}><FileSpreadsheet className="h-4 w-4" /> {importing ? 'Импорт...' : 'Импорт из Excel'}</Button>
          <Button type="button" variant="secondary" onClick={onCheckNormatives}><SearchCheck className="h-4 w-4" /> Проверить нормативы</Button>
          <Button type="button" disabled={readOnly} onClick={onSave}><Save className="h-4 w-4" /> Сохранить</Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1320px] w-full text-left text-sm">
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
                      value={String(row[column.key] ?? row.values?.[column.key] ?? '')}
                      onChange={(event) => updateCell(rowIndex, column.key, event.target.value)}
                    />
                  </td>
                ))}
                <td className="px-3 py-3 align-top"><NormativeStatusBadge status={row.checkStatus || row.internalStatus} /></td>
                <td className="px-3 py-3 align-top">
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" className="px-3" disabled={readOnly} title="Копировать строку" onClick={() => copyRow(rowIndex)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="secondary" className="px-3 text-rose-700 hover:bg-rose-50" disabled={readOnly} title="Удалить строку" onClick={() => deleteRow(rowIndex)}>
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
    </section>
  );
};

export default ProtocolResultsTable;
