import { useFormContext } from 'react-hook-form';
import type { ProtocolWizardForm } from '../wizardTypes';

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-eco-500 focus:outline-none focus:ring-4 focus:ring-eco-100';

const MethodsStep = () => {
  const { register, formState: { errors } } = useFormContext<ProtocolWizardForm>();
  return (
    <section>
      <h3 className="text-xl font-black">Методики испытаний</h3>
      <p className="mt-2 text-sm text-slate-500">Общая методика подставится из показателей, если она одинакова для всех строк. При необходимости укажите её вручную.</p>
      <label className="mt-5 block text-sm font-bold">
        НД на метод испытаний *
        <input {...register('testingMethodNd')} className={`${input} mt-1.5 ${errors.testingMethodNd ? 'border-rose-400' : ''}`} />
        {errors.testingMethodNd?.message && <span className="mt-1 block text-xs text-rose-700">{errors.testingMethodNd.message}</span>}
      </label>
      <label className="mt-4 block text-sm font-bold">
        НД на метод отбора
        <input {...register('samplingMethodNd')} className={`${input} mt-1.5`} />
      </label>
      <label className="mt-4 block text-sm font-bold">
        Основание для испытаний
        <textarea
          rows={2}
          {...register('basis')}
          className={`${input} mt-1.5`}
          placeholder="Например: договор, заявка или программа производственного контроля"
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">Поле сохранится в разделе «Методика» протокола.</span>
      </label>
    </section>
  );
};

export default MethodsStep;
