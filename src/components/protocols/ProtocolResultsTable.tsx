import { useMemo, useState } from 'react';
import { Copy, Edit3, Plus, SearchCheck, Sparkles, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import NormativeStatusBadge from './NormativeStatusBadge';
import protocolService from '../../services/protocolService';
import { getProtocolResultColumns } from '../../data/protocolTemplates';
import type { ProtocolMeasurementDevice, ProtocolResultPayload, ProtocolResultRow, ProtocolSubtype, ProtocolTemplateId } from '../../types/protocols';

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

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100';

const examples = (templateId: ProtocolTemplateId, subtype?: ProtocolSubtype): ProtocolResultPayload[] => {
  if (templateId === 'industrial_emissions') {
    return [
      ['Диоксид азота', '200', '142.6'],
      ['Оксид азота', '400', '186.2'],
      ['Диоксид серы', '500', '18.4'],
      ['Оксид углерода', '250', '212.8'],
    ].map(([indicator, mdvMg, resultMg]) => ({ values: { samplingDate: '2026-06-24', samplingPlace: 'Паровой котёл', sourceNumber: '0001', indicator, temperature: '118', speed: '8.4', gasVolume: '2.18', ductArea: '0.28', mdvMg, mdvGs: '0.55', resultMg, resultGs: String(Number(resultMg) * 0.00218), measurementDeviceId: 'device-dag' }, measurementDeviceId: 'device-dag' }));
  }
  if (templateId === 'water_wastewater') {
    return ['Взвешенные вещества', 'БПК', 'ХПК', 'Азот аммонийный', 'Нитриты', 'Нитраты', 'Фосфаты', 'ПАВ', 'Сульфаты', 'Хлориды', 'Жиры']
      .map((indicator, index) => ({ values: { object: 'Водовыпуск №2', sampleName: 'Проба №12', indicator, unit: 'мг/дм³', testingMethodDocument: 'Методика согласно области аккредитации', normative: String([15, 6, 30, 2, 0.08, 40, 3.5, 0.5, 100, 300, 1][index]), result: String([11, 4.8, 24.2, 1.4, 0.04, 22, 2.1, 0.2, 72, 188, 0.4][index]), externalLaboratory: 'Нет' } }));
  }
  if (templateId === 'ambient_air') {
    return ['Север', 'Юг', 'Восток', 'Запад'].map((direction, index) => ({ values: { direction, samplingPlace: 'Граница СЗЗ', indicator: 'Диоксид азота', unit: 'мг/м³', pdkBackground: '0.2', result: String([0.087, 0.092, 0.078, 0.101][index]), testingMethod: 'МВИ 01-2024', measurementDeviceId: 'device-dag' }, measurementDeviceId: 'device-dag' }));
  }
  if (templateId === 'soil') {
    return [
      ['Мышьяк', '2.0', '1.62', 'ГОСТ 26930'],
      ['Свинец', '32.0', '26.8', 'ГОСТ 26932'],
      ['Нефтепродукты', '0.3', '0.21', 'ПНД Ф 16.1:2.2.22'],
    ].map(([indicator, normativeMax, result, method]) => ({ values: { sampleName: 'Проба почвы №1', samplingPlace: 'Южная граница', indicator, unit: 'мг/кг', testingMethodDocument: method, normativeMax, result } }));
  }
  if (subtype === 'MICROCLIMATE') {
    return [
      ['Температура', '°C', '18', '26', '23.4', 'device-thermometer'],
      ['Влажность', '%', '30', '60', '42', 'device-barometer'],
      ['Скорость движения воздуха', 'м/с', '0', '0.5', '0.18', 'device-anemometer'],
    ].map(([indicator, unit, normativeMin, normativeMax, result, device]) => ({ values: { measurementPlace: 'Рабочее место №1', indicator, unit, testingMethodDocument: 'Санитарные правила РК', normativeMin, normativeMax, result, comparisonType: 'RANGE', measurementDeviceId: device }, measurementDeviceId: device }));
  }
  if (subtype === 'LIGHTING') {
    return [{ values: { measurementPlace: 'Рабочее место №1', indicator: 'Освещённость', unit: 'лк', normativeMin: '300', result: '418', comparisonType: 'GREATER_OR_EQUAL', measurementDeviceId: 'device-lux' }, measurementDeviceId: 'device-lux' }];
  }
  return [
    { values: { measurementPlace: 'Рабочее место №1', factorType: subtype === 'VIBRATION' ? 'VIBRATION' : 'NOISE', indicator: subtype === 'VIBRATION' ? 'Виброускорение' : 'Уровень звука', unit: subtype === 'VIBRATION' ? 'дБ' : 'дБА', normativeMax: subtype === 'VIBRATION' ? '112' : '80', result: subtype === 'VIBRATION' ? '96' : '71', measurementDeviceId: 'device-noise' }, measurementDeviceId: 'device-noise' },
    ...(subtype === 'NOISE_VIBRATION' ? [{ values: { measurementPlace: 'Рабочее место №1', factorType: 'VIBRATION', indicator: 'Виброускорение', unit: 'дБ', normativeMax: '112', result: '96', measurementDeviceId: 'device-noise' }, measurementDeviceId: 'device-noise' }] : []),
  ];
};

const ProtocolResultsTable = ({ protocolId, templateId, subtype, rows, devices = [], readOnly, busy = false, testingDate = '', onChange, onCheckNormatives, onNotify }: Props) => {
  const columns = useMemo(() => getProtocolResultColumns(templateId, subtype), [templateId, subtype]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProtocolResultRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const openNew = (initial: Record<string, string> = {}) => {
    setEditing(null);
    setForm(initial);
    setModalOpen(true);
  };
  const openEdit = (row: ProtocolResultRow) => {
    setEditing(row);
    setForm(Object.fromEntries(Object.entries(row.values).map(([key, value]) => [key, String(value ?? '')])));
    setModalOpen(true);
  };

  const findNormative = async () => {
    if (!form.indicator) return;
    try {
      const found = await protocolService.searchNormative({ templateId, subtype: subtype || '', indicator: form.indicator, unit: form.unit || '', date: testingDate });
      const normative = found.normative || found.normatives?.[0];
      if (!normative) return onNotify('Норматив не найден', 'warning');
      setForm((current) => ({
        ...current,
        unit: normative.unit,
        normative: normative.value,
        normativeMin: normative.min || '',
        normativeMax: normative.max || normative.value,
        comparisonType: normative.comparisonType,
        testingMethod: normative.testingMethod,
        testingMethodDocument: normative.testingMethod,
        normativeDocument: normative.normativeDocument,
        normativeId: normative.id,
      }));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось подобрать норматив', 'error');
    }
  };

  const save = async () => {
    const missing = columns.find((column) => column.required && !form[column.key]?.trim());
    if (missing) return onNotify(`Заполните поле «${missing.label}»`, 'warning');
    setSaving(true);
    try {
      const payload = { values: form, measurementDeviceId: form.measurementDeviceId || undefined, normativeId: form.normativeId || undefined };
      const saved = editing
        ? await protocolService.updateProtocolResult(protocolId, editing.id, payload)
        : await protocolService.addProtocolResult(protocolId, payload);
      onChange(editing ? rows.map((row) => row.id === editing.id ? saved : row) : [...rows, saved]);
      setModalOpen(false);
      onNotify(editing ? 'Результат изменён' : 'Результат добавлен', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось сохранить результат', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: ProtocolResultRow) => {
    if (!window.confirm('Удалить строку результата?')) return;
    try {
      await protocolService.deleteProtocolResult(protocolId, row.id);
      onChange(rows.filter((item) => item.id !== row.id));
      onNotify('Результат удалён', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось удалить результат', 'error');
    }
  };

  const duplicate = (row: ProtocolResultRow) => openNew(Object.fromEntries(Object.entries(row.values).map(([key, value]) => [key, String(value ?? '')])));

  const fillExamples = async () => {
    setSaving(true);
    try {
      const saved = await Promise.all(examples(templateId, subtype).map((payload) => protocolService.addProtocolResult(protocolId, payload)));
      onChange([...rows, ...saved]);
      onNotify('Пример результатов добавлен', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось добавить пример', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Результаты испытаний</h2>
          <p className="mt-1 text-sm text-slate-500">Структура таблицы соответствует выбранному типу протокола.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={readOnly || busy || saving} onClick={fillExamples}><Sparkles className="h-4 w-4" /> Заполнить примером</Button>
          <Button type="button" variant="secondary" disabled={busy || saving} onClick={onCheckNormatives}><SearchCheck className="h-4 w-4" /> Проверить нормативы</Button>
          <Button type="button" disabled={readOnly || busy || saving} onClick={() => openNew()}><Plus className="h-4 w-4" /> Добавить строку</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth: `${Math.max(960, columns.length * 150 + 210)}px` }}>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => <th key={column.key} className="px-3 py-3">{column.label}</th>)}
              <th className="px-3 py-3">Статус</th>
              <th className="px-3 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {columns.map((column) => <td key={column.key} className="max-w-[220px] break-words px-3 py-3">{String(row.values[column.key] ?? '—')}</td>)}
                <td className="px-3 py-3"><NormativeStatusBadge status={row.internalStatus || row.checkStatus} /></td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="secondary" className="px-2.5" disabled={readOnly} title="Редактировать" onClick={() => openEdit(row)}><Edit3 className="h-4 w-4" /></Button>
                    <Button type="button" variant="secondary" className="px-2.5" disabled={readOnly} title="Дублировать" onClick={() => duplicate(row)}><Copy className="h-4 w-4" /></Button>
                    <Button type="button" variant="secondary" className="px-2.5 text-rose-700" disabled={readOnly} title="Удалить" onClick={() => remove(row)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <div className="border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">Результаты ещё не добавлены.</div>}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Редактировать результат' : 'Добавить результат'} size="xl" loading={saving}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((column) => (
            <label key={column.key} className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>{column.label}{column.required && <span className="text-rose-600"> *</span>}</span>
              {column.type === 'select' ? (
                <select value={form[column.key] || ''} onChange={(event) => setForm({ ...form, [column.key]: event.target.value })} className={inputClass}>
                  <option value="">Выберите</option>
                  {column.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              ) : column.type === 'device' ? (
                <select value={form[column.key] || ''} onChange={(event) => setForm({ ...form, [column.key]: event.target.value })} className={inputClass}>
                  <option value="">Не выбран</option>
                  {devices.map((device) => <option key={device.deviceId} value={device.deviceId} disabled={device.deviceSnapshot.status === 'EXPIRED'}>{device.deviceSnapshot.name} · {device.deviceSnapshot.serialNumber}</option>)}
                </select>
              ) : (
                <input
                  type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
                  step={column.type === 'number' ? 'any' : undefined}
                  value={form[column.key] || ''}
                  onChange={(event) => setForm({ ...form, [column.key]: event.target.value })}
                  onBlur={column.key === 'indicator' ? findNormative : undefined}
                  className={inputClass}
                />
              )}
            </label>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Отмена</Button>
          <Button type="button" onClick={save} disabled={saving}>{editing ? 'Сохранить изменения' : 'Добавить результат'}</Button>
        </div>
      </Modal>
    </section>
  );
};

export default ProtocolResultsTable;
