import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { MeasurementDevice } from '../../../../types/protocols';
import { isDeviceValidForDate } from '../../../../utils/protocolDevices';
import ProtocolResultRow from './ProtocolResultRow';
import { CHEMICAL_TYPES, emptyWizardResult, type ProtocolWizardForm } from '../wizardTypes';
import { validateProtocolWizardStep } from '../../utils/protocolWizardValidation';

type Props = { devices: MeasurementDevice[]; onSelectNormatives: () => void; onAddManual: () => void };

const ProtocolResultTable = ({ devices, onSelectNormatives, onAddManual }: Props) => {
  const { control, watch, setValue } = useFormContext<ProtocolWizardForm>();
  const { fields, append, remove } = useFieldArray({ control, name: 'results' });
  const values = watch();
  const validationIssues = validateProtocolWizardStep(values, 2).filter((item) => item.severity === 'ERROR');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);
  const chemical = Boolean(values.templateId && CHEMICAL_TYPES.has(values.templateId));
  const selectedIndexes = fields.flatMap((field, index) => selected.has(field.id) ? [index] : []);
  const targets = selectedIndexes.length ? selectedIndexes : fields.map((_, index) => index);
  const apply = (field: 'measurementDeviceId' | 'testingMethodNd' | 'samplingPlace' | 'samplingDate', value: string) => {
    targets.forEach((index) => setValue(`results.${index}.${field}`, value, { shouldDirty: true }));
  };
  const duplicate = (index: number) => append({ ...emptyWizardResult(), ...values.results[index], clientRowId: crypto.randomUUID(), serverResultId: undefined });
  const removeRows = (indexes: number[]) => { remove([...indexes].sort((a, b) => b - a)); setSelected(new Set()); setExpanded(null); };

  if (!fields.length) return <div><div className="rounded-2xl border border-dashed border-eco-300 bg-eco-50/50 px-5 py-8 text-center"><p className="font-bold text-slate-900">Показатели ещё не выбраны</p><p className="mt-1 text-sm text-slate-600">Найдите норматив или добавьте строку вручную. Черновик можно сохранить и без результатов.</p></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={onSelectNormatives} className="inline-flex items-center gap-2 rounded-xl border border-eco-300 px-4 py-2.5 text-sm font-bold text-eco-800"><Plus className="h-4 w-4" /> Выбрать норматив</button><button type="button" onClick={onAddManual} className="inline-flex items-center gap-2 rounded-xl border border-eco-300 px-4 py-2.5 text-sm font-bold text-eco-800"><Plus className="h-4 w-4" /> Добавить вручную</button></div></div>;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
      <span className="font-semibold">{selectedIndexes.length ? `Выбрано: ${selectedIndexes.length}` : 'Массовые действия применятся ко всем строкам'}</span>
      <button type="button" disabled={!values.defaultMeasurementDeviceId} onClick={() => apply('measurementDeviceId', values.defaultMeasurementDeviceId)} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-50">Применить прибор</button>
      <button type="button" disabled={!values.testingMethodNd} onClick={() => apply('testingMethodNd', values.testingMethodNd)} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-50">Применить методику</button>
      <button type="button" disabled={!values.measurementPlace} onClick={() => apply('samplingPlace', values.measurementPlace)} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-50">Применить место</button>
      <button type="button" disabled={!values.sampleDate} onClick={() => apply('samplingDate', values.sampleDate)} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-50">Применить дату</button>
      {selectedIndexes.length > 0 && <button type="button" onClick={() => removeRows(selectedIndexes)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 font-semibold text-rose-700">Удалить выбранные</button>}
    </div>

    <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
      <table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3"><input type="checkbox" aria-label="Выбрать все результаты" checked={selected.size === fields.length} onChange={(event) => setSelected(event.target.checked ? new Set(fields.map((field) => field.id)) : new Set())} /></th>{['Показатель', 'Результат', 'Ед. изм.', 'Норматив', 'Прибор', 'Статус', 'Действия'].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{fields.map((field, index) => {
        const row = values.results[index];
        const device = devices.find((item) => String(item.id) === row.measurementDeviceId);
        const invalidDevice = Boolean(row.measurementDeviceId && (!device || !isDeviceValidForDate(device, values.measurementDate)));
        const rowIssue = validationIssues.find((item) => item.resultClientRowId === row.clientRowId || item.field.startsWith(`results.${index}.`));
        return <tr key={field.id} className="border-t"><td className="p-3"><input type="checkbox" aria-label={`Выбрать строку ${index + 1}`} checked={selected.has(field.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(field.id); else next.delete(field.id); return next; })} /></td><td className="p-3 font-semibold">{row.indicatorName || `Строка ${index + 1}`}</td><td className="p-3"><input aria-label={`Результат строки ${index + 1}`} value={row.value} onChange={(event) => setValue(`results.${index}.value`, event.target.value, { shouldDirty: true })} className="w-28 rounded-lg border px-2 py-1.5" /></td><td className="p-3">{row.unit || '—'}</td><td className="p-3">{row.normativeValue || row.normativeMax || 'Без норматива'}</td><td className="p-3">{device?.name || device?.model || 'Не выбран'}</td><td className={`p-3 font-semibold ${invalidDevice || rowIssue ? 'text-amber-700' : 'text-emerald-700'}`} title={rowIssue?.message}>{invalidDevice ? 'Прибор недоступен' : rowIssue ? 'Нужно заполнить' : 'Заполнено'}</td><td className="p-3"><div className="flex gap-1"><button type="button" aria-label={`Изменить строку ${index + 1}`} onClick={() => setExpanded(expanded === index ? null : index)} className="rounded-lg p-2 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button><button type="button" aria-label={`Дублировать строку ${index + 1}`} onClick={() => duplicate(index)} className="rounded-lg p-2 hover:bg-slate-100"><Copy className="h-4 w-4" /></button><button type="button" aria-label={`Удалить строку ${index + 1}`} onClick={() => removeRows([index])} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></div></td></tr>;
      })}</tbody></table>
    </div>
    {expanded != null && fields[expanded] && <div className="hidden md:block"><ProtocolResultRow index={expanded} chemical={chemical} devices={devices} measurementDate={values.measurementDate} laboratoryId={values.laboratoryId} invalidDevice={(() => { const selectedDeviceId = values.results[expanded].measurementDeviceId; const selectedDevice = devices.find((item) => String(item.id) === selectedDeviceId); return Boolean(selectedDeviceId && (!selectedDevice || !isDeviceValidForDate(selectedDevice, values.measurementDate))); })()} onRemove={() => removeRows([expanded])} /></div>}
    <div className="space-y-4 md:hidden">{fields.map((field, index) => { const row = values.results[index]; const device = devices.find((item) => String(item.id) === row.measurementDeviceId); return <ProtocolResultRow key={field.id} index={index} chemical={chemical} devices={devices} measurementDate={values.measurementDate} laboratoryId={values.laboratoryId} invalidDevice={Boolean(row.measurementDeviceId && (!device || !isDeviceValidForDate(device, values.measurementDate)))} onRemove={() => removeRows([index])} />; })}</div>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={onSelectNormatives} className="inline-flex items-center gap-2 rounded-xl border border-eco-300 px-4 py-2.5 text-sm font-bold text-eco-800"><Plus className="h-4 w-4" /> Выбрать норматив</button><button type="button" onClick={onAddManual} className="inline-flex items-center gap-2 rounded-xl border border-eco-300 px-4 py-2.5 text-sm font-bold text-eco-800"><Plus className="h-4 w-4" /> Добавить вручную</button></div>
  </div>;
};

export default ProtocolResultTable;
