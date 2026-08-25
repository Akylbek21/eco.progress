import { ArrowDown, ArrowUp, MapPin, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { createWizardSamplingPoint, type ProtocolWizardForm } from '../wizardTypes';

const inputClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100';

const SamplingPointsEditor = () => {
  const { control, register, getValues, setValue } = useFormContext<ProtocolWizardForm>();
  const { fields, append, remove, move } = useFieldArray({ control, name: 'samplingPoints' });

  const removePoint = (index: number) => {
    const point = getValues(`samplingPoints.${index}`);
    getValues('results').forEach((row, resultIndex) => {
      if (row.samplingPointId === point.clientPointId || row.samplingPointId === point.serverPointId) {
        setValue(`results.${resultIndex}.samplingPointId`, '', { shouldDirty: true });
      }
    });
    remove(index);
  };

  const movePoint = (from: number, to: number) => {
    move(from, to);
    getValues('samplingPoints').forEach((_, index) => setValue(`samplingPoints.${index}.sortOrder`, index, { shouldDirty: true }));
  };

  return <section aria-labelledby="sampling-points-title" className="rounded-2xl border border-eco-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 id="sampling-points-title" className="flex items-center gap-2 text-lg font-black text-slate-950"><MapPin className="h-5 w-5 text-eco-700" />Места отбора</h3>
        <p className="mt-1 text-sm text-slate-600">Названия можно изменить. Север, Юг, Восток и Запад — только предлагаемый начальный набор.</p>
      </div>
      <button type="button" onClick={() => append({ ...createWizardSamplingPoint(), sortOrder: fields.length })} className="inline-flex items-center gap-2 rounded-xl bg-eco-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-eco-800"><Plus className="h-4 w-4" />Добавить место отбора</button>
    </div>

    {!fields.length && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Добавьте хотя бы одно место отбора перед заполнением результатов.</p>}

    <div className="mt-4 space-y-3">
      {fields.map((field, index) => <article key={field.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <strong className="text-sm text-slate-800">Точка {index + 1}</strong>
          <div className="flex gap-1">
            <button type="button" aria-label={`Переместить точку ${index + 1} выше`} disabled={index === 0} onClick={() => movePoint(index, index - 1)} className="rounded-lg p-2 hover:bg-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
            <button type="button" aria-label={`Переместить точку ${index + 1} ниже`} disabled={index === fields.length - 1} onClick={() => movePoint(index, index + 1)} className="rounded-lg p-2 hover:bg-white disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
            <button type="button" aria-label={`Удалить точку ${index + 1}`} onClick={() => removePoint(index)} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
        <input type="hidden" {...register(`samplingPoints.${index}.clientPointId`)} />
        <input type="hidden" {...register(`samplingPoints.${index}.serverPointId`)} />
        <input type="hidden" {...register(`samplingPoints.${index}.sortOrder`, { valueAsNumber: true })} />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold">Название *<input {...register(`samplingPoints.${index}.name`, { required: true })} className={inputClass} placeholder="Например: Северная граница СЗЗ" /></label>
          <label className="text-sm font-semibold">Описание<input {...register(`samplingPoints.${index}.description`)} className={inputClass} placeholder="Ориентир или условия отбора" /></label>
          <label className="text-sm font-semibold">Широта<input type="number" step="any" min="-90" max="90" {...register(`samplingPoints.${index}.latitude`)} className={inputClass} placeholder="42.315" /></label>
          <label className="text-sm font-semibold">Долгота<input type="number" step="any" min="-180" max="180" {...register(`samplingPoints.${index}.longitude`)} className={inputClass} placeholder="69.590" /></label>
        </div>
      </article>)}
    </div>
  </section>;
};

export default SamplingPointsEditor;
