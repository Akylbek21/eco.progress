import { Copy, Trash2 } from 'lucide-react';
import { Controller, useFormContext } from 'react-hook-form';
import type { MeasurementDevice } from '../../../../types/protocols';
import DeviceSelector from './DeviceSelector';
import ProtocolResultDetails from './ProtocolResultDetails';
import type { ProtocolWizardForm } from '../wizardTypes';

type Props = { index: number; chemical: boolean; devices: MeasurementDevice[]; measurementDate: string; laboratoryId: string; invalidDevice: boolean; onDuplicate: () => void; onRemove: () => void };
const cell = 'min-w-32 rounded-lg border border-slate-200 px-2 py-2 text-xs focus:border-eco-500 focus:outline-none';
const ProtocolResultRow = ({ index, chemical, devices, measurementDate, laboratoryId, invalidDevice, onDuplicate, onRemove }: Props) => {
  const { register, control, watch } = useFormContext<ProtocolWizardForm>(); const row = watch(`results.${index}`);
  return <tr data-result-index={index} className={invalidDevice ? 'bg-rose-50' : 'bg-white'}>
    <td className="px-2 py-2 font-bold">{index + 1}</td>
    <td className="px-2 py-2"><input aria-label={`Показатель строки ${index + 1}`} {...register(`results.${index}.indicatorName`)} className={cell} /><ProtocolResultDetails index={index} /></td>
    <td className="px-2 py-2"><input aria-label={chemical ? 'Код вещества' : 'Тип фактора'} {...register(chemical ? `results.${index}.pollutantCode` : `results.${index}.factorType`)} className={cell} /></td>
    <td className="px-2 py-2"><input aria-label="Единица измерения" {...register(`results.${index}.unit`)} className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-xs" /></td>
    <td className="px-2 py-2"><input aria-label="Результат" {...register(`results.${index}.value`)} className="w-28 rounded-lg border border-slate-200 px-2 py-2 text-xs" /></td>
    <td className="px-2 py-2"><input aria-label="Место отбора" {...register(`results.${index}.samplingPlace`)} className={cell} /></td>
    <td className="px-2 py-2"><Controller control={control} name={`results.${index}.measurementDeviceId`} render={({ field }) => <DeviceSelector value={field.value} onChange={field.onChange} devices={devices} measurementDate={measurementDate} laboratoryId={laboratoryId} error={invalidDevice} />} />{invalidDevice && <p className="mt-1 text-xs font-bold text-rose-700">Прибор недействителен на дату измерения.</p>}</td>
    <td className="px-2 py-2"><input readOnly value={String(row?.normativeValue || '')} className="w-32 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs" /></td>
    <td className="px-2 py-2 text-xs text-slate-500">После расчёта</td>
    <td className="px-2 py-2"><div className="flex gap-1"><button type="button" onClick={onDuplicate} className="rounded-lg p-2 text-eco-700 hover:bg-eco-50" aria-label={`Дублировать строку ${index + 1}`}><Copy className="h-4 w-4" /></button><button type="button" onClick={onRemove} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50" aria-label={`Удалить строку ${index + 1}`}><Trash2 className="h-4 w-4" /></button></div></td>
  </tr>;
};
export default ProtocolResultRow;
