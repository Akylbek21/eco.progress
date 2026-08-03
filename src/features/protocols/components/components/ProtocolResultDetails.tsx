import { ChevronDown } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { CHEMICAL_TYPES, type ProtocolWizardForm } from '../wizardTypes';

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-eco-500 focus:ring-2 focus:ring-eco-100';
const labelClass = 'block text-xs font-bold text-slate-600';

const ProtocolResultDetails = ({ index }: { index: number }) => {
  const { register, watch, formState: { errors } } = useFormContext<ProtocolWizardForm>();
  const type = watch('templateId');
  const chemical = Boolean(type && CHEMICAL_TYPES.has(type));
  const rowErrors = errors.results?.[index];
  const normativeSource = watch(`results.${index}.normativeSource`);

  return (
    <details className="group border-t border-slate-100">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-eco-800 transition hover:bg-eco-50/60 sm:px-5">
        <span>
          Дополнительные сведения
          <span className="ml-2 font-normal text-slate-500">
            заполняются по акту отбора и методике
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
      </summary>

      <div className="grid gap-4 border-t border-slate-100 bg-slate-50/40 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
        {normativeSource === 'MANUAL' && <>
          <label className={labelClass}>Нормативное значение<input inputMode="decimal" placeholder="Например, 0,5" {...register(`results.${index}.normativeValue`)} className={inputClass} /></label>
          <label className={labelClass}>Сравнение<select {...register(`results.${index}.comparisonType`)} className={inputClass}><option value="LESS_OR_EQUAL">≤</option><option value="GREATER_OR_EQUAL">≥</option><option value="EQUAL">=</option><option value="RANGE">Диапазон</option></select></label>
          <label className={labelClass}>Минимум<input inputMode="decimal" {...register(`results.${index}.normativeMin`)} className={inputClass} /></label>
          <label className={labelClass}>Максимум<input inputMode="decimal" {...register(`results.${index}.normativeMax`)} className={inputClass} /></label>
          <label className={`${labelClass} sm:col-span-2`}>Нормативный документ<input placeholder="Например, ДСМ-70" {...register(`results.${index}.normativeDocument`)} className={inputClass} /></label>
        </>}
        <label className={labelClass}>
          Код методики
          <input
            placeholder="НД или код методики"
            {...register(`results.${index}.testingMethodNd`)}
            className={`${inputClass} ${rowErrors?.testingMethodNd ? 'border-rose-400' : ''}`}
          />
          {rowErrors?.testingMethodNd?.message && <span className="mt-1 block text-xs text-rose-700">{rowErrors.testingMethodNd.message}</span>}
        </label>
        <label className={labelClass}>
          Наименование методики
          <input
            placeholder="Наименование методики"
            {...register(`results.${index}.methodName`)}
            className={inputClass}
          />
        </label>
        {chemical && (
          <>
            <label className={labelClass}>
              CAS-номер
              <input
                placeholder="Например, 50-00-0"
                {...register(`results.${index}.cas`)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Химическая формула
              <input
                placeholder="Например, HCHO"
                {...register(`results.${index}.formula`)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Скорость отбора
              <input
                inputMode="decimal"
                placeholder="По методике отбора"
                {...register(`results.${index}.samplingSpeed`)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Объём пробы
              <input
                inputMode="decimal"
                placeholder="По акту отбора"
                {...register(`results.${index}.sampleVolume`)}
                className={inputClass}
              />
            </label>
          </>
        )}

        {type === 'soil' && (
          <>
            <label className={labelClass}>
              Номер пробы
              <input
                placeholder="Например, П-2026-014"
                {...register(`results.${index}.sampleNumber`)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Глубина отбора
              <input
                inputMode="decimal"
                placeholder="По акту отбора"
                {...register(`results.${index}.samplingDepth`)}
                className={inputClass}
              />
            </label>
          </>
        )}

        {type === 'water' && (
          <>
            <label className={labelClass}>
              Тип воды для этой пробы
              <input
                placeholder="Характеристика отдельной пробы"
                {...register(`results.${index}.waterType`)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Номер образца
              <input
                placeholder="Например, В-2026-014"
                {...register(`results.${index}.sampleNumber`)}
                className={inputClass}
              />
            </label>
          </>
        )}

        {!chemical && (
          <>
            <label className={labelClass}>
              Минимальное значение
              <input
                inputMode="decimal"
                placeholder="Минимум"
                {...register(`results.${index}.minimumValue`)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Максимальное значение
              <input
                inputMode="decimal"
                placeholder="Максимум"
                {...register(`results.${index}.maximumValue`)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Среднее значение
              <input
                inputMode="decimal"
                placeholder="Среднее"
                {...register(`results.${index}.averageValue`)}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Продолжительность
              <input
                inputMode="decimal"
                placeholder="По методике измерения"
                {...register(`results.${index}.duration`)}
                className={inputClass}
              />
            </label>
          </>
        )}
      </div>
    </details>
  );
};

export default ProtocolResultDetails;
