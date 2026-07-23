import { useFormContext } from 'react-hook-form';
import { CHEMICAL_TYPES, type ProtocolWizardForm } from '../wizardTypes';

const field = 'w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs';
const ProtocolResultDetails = ({ index }: { index: number }) => {
  const { register, watch } = useFormContext<ProtocolWizardForm>();
  const type = watch('templateId');
  const chemical = Boolean(type && CHEMICAL_TYPES.has(type));
  return <details className="mt-2 text-xs"><summary className="cursor-pointer font-bold text-eco-700">Дополнительные поля</summary><div className="mt-2 grid gap-1">
    {chemical && <><input placeholder="CAS" {...register(`results.${index}.cas`)} className={field} /><input placeholder="Формула" {...register(`results.${index}.formula`)} className={field} /><input placeholder="Скорость отбора" {...register(`results.${index}.samplingSpeed`)} className={field} /><input placeholder="Объём пробы" {...register(`results.${index}.sampleVolume`)} className={field} /></>}
    {type === 'soil' && <><input placeholder="Номер пробы" {...register(`results.${index}.sampleNumber`)} className={field} /><input placeholder="Глубина отбора" {...register(`results.${index}.samplingDepth`)} className={field} /></>}
    {type === 'water_wastewater' && <><input placeholder="Тип воды" {...register(`results.${index}.waterType`)} className={field} /><input placeholder="Номер образца" {...register(`results.${index}.sampleNumber`)} className={field} /></>}
    {!chemical && <><input placeholder="Минимальное значение" {...register(`results.${index}.minimumValue`)} className={field} /><input placeholder="Максимальное значение" {...register(`results.${index}.maximumValue`)} className={field} /><input placeholder="Среднее значение" {...register(`results.${index}.averageValue`)} className={field} /><input placeholder="Продолжительность" {...register(`results.${index}.duration`)} className={field} /></>}
  </div></details>;
};
export default ProtocolResultDetails;
