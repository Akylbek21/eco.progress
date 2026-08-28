import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFormContext, type UseFieldArrayReturn } from 'react-hook-form';
import type { ComparisonType, MeasurementDevice } from '../../../../types/protocols';
import { isDeviceValidForDate } from '../../../../utils/protocolDevices';
import ProtocolResultRow from './ProtocolResultRow';
import { CHEMICAL_TYPES, emptyWizardResult, type ProtocolWizardForm } from '../wizardTypes';
import { validateProtocolWizardStep } from '../../utils/protocolWizardValidation';
import { calculateCompliance } from '../../utils/protocolCalculations';

type Props = {
  devices: MeasurementDevice[];
  fieldArray: UseFieldArrayReturn<ProtocolWizardForm, 'results', 'id'>;
  onSelectNormatives: () => void;
  onAddManual: () => void;
  activeSamplingPointId?: string;
};

const ProtocolResultTable = ({ devices, fieldArray, onSelectNormatives, onAddManual, activeSamplingPointId }: Props) => {
  // Статусы старого интерфейса rowIssue ? 'Нужно заполнить' : 'Заполнено' заменены нормативными badge ниже.
  const { watch, setValue } = useFormContext<ProtocolWizardForm>();
  const { fields, append, remove } = fieldArray;
  const values = watch();
  const validationIssues = validateProtocolWizardStep(values, 2).filter((item) => item.severity === 'ERROR');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);
  const chemical = Boolean(values.templateId && CHEMICAL_TYPES.has(values.templateId));
  const selectedIndexes = fields.flatMap((field, index) => selected.has(field.id) ? [index] : []);
  const ambient = values.templateId === 'ambient_air';
  const visibleIndexes = fields.flatMap((_, index) => {
    if (!ambient) return [index];
    const point = values.samplingPoints.find((item) => item.clientPointId === activeSamplingPointId);
    return values.results[index]?.samplingPointId === activeSamplingPointId || values.results[index]?.samplingPointId === point?.serverPointId ? [index] : [];
  });
  const targets = selectedIndexes.length ? selectedIndexes : fields.map((_, index) => index);
  const apply = (field: 'measurementDeviceId' | 'testingMethodNd' | 'samplingPlace' | 'samplingDate', value: string) => {
    targets.forEach((index) => setValue(`results.${index}.${field}`, value, { shouldDirty: true }));
  };
  const duplicate = (index: number) => append({ ...emptyWizardResult(), ...values.results[index], clientRowId: crypto.randomUUID(), serverResultId: undefined });
  const removeRows = (indexes: number[]) => { remove([...indexes].sort((a, b) => b - a)); setSelected(new Set()); setExpanded(null); };

  if (!visibleIndexes.length) return <div><div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center"><p className="font-semibold text-slate-900">{ambient ? 'Для этой точки показатели ещё не добавлены' : 'Показатели ещё не выбраны'}</p><p className="mt-1 text-sm text-slate-500">Добавьте показатель из справочника или создайте строку вручную.</p></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={ambient && !activeSamplingPointId} onClick={onSelectNormatives} className="inline-flex items-center gap-2 rounded-xl border border-eco-300 px-4 py-2.5 text-sm font-medium text-eco-800 disabled:opacity-40"><Plus className="h-4 w-4" /> Из справочника</button><button type="button" disabled={ambient && !activeSamplingPointId} onClick={onAddManual} className="inline-flex items-center gap-2 rounded-xl border border-eco-300 px-4 py-2.5 text-sm font-medium text-eco-800 disabled:opacity-40"><Plus className="h-4 w-4" /> Вручную</button></div></div>;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
      <span className="font-semibold">{selectedIndexes.length ? `Выбрано: ${selectedIndexes.length}` : 'Массовые действия применятся ко всем строкам'}</span>
      <button type="button" disabled={!values.defaultMeasurementDeviceId} onClick={() => apply('measurementDeviceId', values.defaultMeasurementDeviceId)} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-50">Применить прибор</button>
      <button type="button" disabled={!values.testingMethodNd} onClick={() => apply('testingMethodNd', values.testingMethodNd)} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-50">Применить методику</button>
      <button type="button" disabled={!values.measurementPlace} onClick={() => apply('samplingPlace', values.measurementPlace)} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-50">Применить место</button>
      <button type="button" disabled={!values.sampleDate} onClick={() => apply('samplingDate', values.sampleDate)} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-50">Применить дату</button>
      {selectedIndexes.length > 0 && <button type="button" onClick={() => removeRows(selectedIndexes)} className="rounded-lg border border-rose-200 bg-white px-3 py-2 font-semibold text-rose-700">Удалить выбранные</button>}
    </div>

    <div className="hidden max-w-full overflow-x-auto rounded-xl border border-slate-200 md:block">
      <table className="w-full min-w-[980px] table-fixed text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="w-10 p-2.5"><input type="checkbox" aria-label="Выбрать все результаты" checked={visibleIndexes.length > 0 && visibleIndexes.every((index) => selected.has(fields[index].id))} onChange={(event) => setSelected(event.target.checked ? new Set(visibleIndexes.map((index) => fields[index].id)) : new Set())} /></th>{['Показатель', 'Результат', 'Единица', 'Норма', 'Прибор', 'Статус', 'Действия'].map((label) => <th key={label} className="p-2.5">{label}</th>)}</tr></thead><tbody>{visibleIndexes.map((index) => {
        const field = fields[index];
        const row = values.results[index];
        const device = devices.find((item) => String(item.id) === row.measurementDeviceId);
        const invalidDevice = Boolean(row.measurementDeviceId && (!device || !isDeviceValidForDate(device, values.measurementDate)));
        const rowIssue = validationIssues.find((item) => item.resultClientRowId === row.clientRowId || item.field.startsWith(`results.${index}.`));
        const numeric = (value: string) => { const parsed = Number(value.replace(',', '.')); return Number.isFinite(parsed) ? parsed : undefined; };
        const compliance = calculateCompliance({ result: numeric(row.value), comparisonType: row.comparisonType as ComparisonType, normativeValue: numeric(row.normativeValue), normativeMin: numeric(row.normativeMin), normativeMax: numeric(row.normativeMax || row.normativeValue) });
        const normativeLabel = row.normativeSource === 'NONE' ? 'Нет норматива' : row.normativeStatus === 'REVIEW' || row.normativeStatus === 'INACTIVE' ? 'Не проверено' : compliance === 'NORMAL' ? 'Норма' : ['EXCEEDED', 'BELOW_REQUIRED'].includes(compliance) ? 'Превышение' : 'Не проверено';
        return <tr key={field.id} className="border-t align-top"><td className="p-2.5"><input type="checkbox" aria-label={`Выбрать строку ${index + 1}`} checked={selected.has(field.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(field.id); else next.delete(field.id); return next; })} /></td><td className="p-2.5 text-sm font-medium text-slate-800">{row.indicatorName || `Строка ${index + 1}`}</td><td className="p-2"><input aria-label={`Результат строки ${index + 1}`} value={row.value} onChange={(event) => setValue(`results.${index}.value`, event.target.value, { shouldDirty: true })} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" /></td><td className="p-2"><input aria-label={`Единица строки ${index + 1}`} value={row.unit} readOnly={ambient && row.normativeSource === 'DIRECTORY'} onChange={(event) => setValue(`results.${index}.unit`, event.target.value, { shouldDirty: true })} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm read-only:bg-slate-50" /></td><td className="p-2"><input aria-label={`Норма строки ${index + 1}`} value={row.normativeValue || row.normativeMax} readOnly={row.normativeSource === 'DIRECTORY'} onChange={(event) => setValue(`results.${index}.normativeValue`, event.target.value, { shouldDirty: true })} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm read-only:bg-slate-50" /></td><td className="p-2"><select aria-label={`Прибор строки ${index + 1}`} value={row.measurementDeviceId} onChange={(event) => setValue(`results.${index}.measurementDeviceId`, event.target.value, { shouldDirty: true })} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Не выбран</option>{devices.map((item) => <option key={item.id} value={item.id}>{item.name || item.model}</option>)}</select></td><td className="p-2.5"><span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${normativeLabel === 'Норма' ? 'bg-emerald-50 text-emerald-700' : normativeLabel === 'Превышение' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`} title={rowIssue?.message}>{invalidDevice ? 'Прибор недоступен' : normativeLabel}</span></td><td className="p-2"><div className="flex gap-1"><button type="button" aria-label={`Изменить строку ${index + 1}`} onClick={() => setExpanded(expanded === index ? null : index)} className="rounded-lg p-2 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button><button type="button" aria-label={`Дублировать строку ${index + 1}`} onClick={() => duplicate(index)} className="rounded-lg p-2 hover:bg-slate-100"><Copy className="h-4 w-4" /></button><button type="button" aria-label={`Удалить строку ${index + 1}`} onClick={() => removeRows([index])} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></div></td></tr>;
      })}</tbody></table>
    </div>
    {expanded != null && fields[expanded] && <div className="hidden md:block"><ProtocolResultRow index={expanded} chemical={chemical} devices={devices} measurementDate={values.measurementDate} laboratoryId={values.laboratoryId} invalidDevice={(() => { const selectedDeviceId = values.results[expanded].measurementDeviceId; const selectedDevice = devices.find((item) => String(item.id) === selectedDeviceId); return Boolean(selectedDeviceId && (!selectedDevice || !isDeviceValidForDate(selectedDevice, values.measurementDate))); })()} onRemove={() => removeRows([expanded])} /></div>}
    <div className="space-y-4 md:hidden">{visibleIndexes.map((index) => { const field = fields[index]; const row = values.results[index]; const device = devices.find((item) => String(item.id) === row.measurementDeviceId); return <ProtocolResultRow key={field.id} index={index} chemical={chemical} devices={devices} measurementDate={values.measurementDate} laboratoryId={values.laboratoryId} invalidDevice={Boolean(row.measurementDeviceId && (!device || !isDeviceValidForDate(device, values.measurementDate)))} onRemove={() => removeRows([index])} />; })}</div>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={onSelectNormatives} className="inline-flex items-center gap-2 rounded-xl border border-eco-300 px-4 py-2.5 text-sm font-bold text-eco-800"><Plus className="h-4 w-4" /> Выбрать норматив</button><button type="button" onClick={onAddManual} className="inline-flex items-center gap-2 rounded-xl border border-eco-300 px-4 py-2.5 text-sm font-bold text-eco-800"><Plus className="h-4 w-4" /> Добавить вручную</button></div>
  </div>;
};

export default ProtocolResultTable;
